const { PutObjectCommand, DeleteObjectCommand } = require("@aws-sdk/client-s3");
const { r2Client, bucketName, publicUrl, isLive } = require("../config/cloudflare");
const pool = require("../config/database");
const { validateBase64Image } = require("../utils/validation");
const { optimizeImage } = require("../utils/imageOptimizer");

class CloudflareService {
  /**
   * Uploads a Buffer to Cloudflare R2 or returns a debug URL when in test mode.
   */
  async uploadBuffer(buffer, key, mimeType = "image/webp") {
    if (isLive && r2Client && bucketName) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        Body: buffer,
        ContentType: mimeType
      });
      await r2Client.send(command);

      const baseUrl = publicUrl ? publicUrl : `https://${bucketName}.r2.dev`;
      return `${baseUrl}/${key}`;
    }

    // Debug / Mock Mode
    const baseUrl = publicUrl || "https://pub-debug-storage.r2.dev";
    return `${baseUrl}/${key}`;
  }

  /**
   * Deletes an object from Cloudflare R2 by key or URL.
   */
  async deleteAsset(keyOrUrl) {
    if (!keyOrUrl || !isLive || !r2Client || !bucketName) return;

    try {
      let key = keyOrUrl;
      if (keyOrUrl.startsWith("http://") || keyOrUrl.startsWith("https://")) {
        const parsed = new URL(keyOrUrl);
        key = parsed.pathname.replace(/^\/+/, "");
      }

      const command = new DeleteObjectCommand({
        Bucket: bucketName,
        Key: key
      });
      await r2Client.send(command);
    } catch (err) {
      console.error("Cloudflare R2 asset deletion error:", err);
    }
  }

  /**
   * Manages user gallery photos (up to 5 images max) with automatic optimization
   */
  async managePhotos(userId, existingImages = [], newImages = []) {
    if (!Array.isArray(existingImages)) existingImages = [];
    if (!Array.isArray(newImages)) newImages = [];

    if (existingImages.length + newImages.length > 5) {
      return { success: 0, message: "Maximum 5 images are allowed" };
    }

    // 1. Fetch current DB photos
    const [dbPhotos] = await pool.execute(
      "SELECT id, image_url FROM user_photos WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );

    const keepFilenames = existingImages
      .filter((img) => typeof img === "string" && img.trim() !== "")
      .map((img) => img.split("/").pop());

    // Delete photos removed by user
    for (const dbPhoto of dbPhotos) {
      const filename = dbPhoto.image_url.split("/").pop();
      if (!keepFilenames.includes(filename)) {
        await pool.execute("DELETE FROM user_photos WHERE id = $1 AND user_id = $2", [dbPhoto.id, userId]);
        await this.deleteAsset(dbPhoto.image_url);
      }
    }

    // 2. Validate, optimize and upload new base64 images
    const uploadedUrls = [];
    const errors = [];

    for (let i = 0; i < newImages.length; i++) {
      const b64 = newImages[i];
      const valid = validateBase64Image(b64);
      if (!valid.ok) {
        errors[i] = valid.error;
        continue;
      }

      try {
        // Optimize: compress size by 70-80% while retaining high visual quality
        const optimized = await optimizeImage(valid.buffer, {
          maxWidth: 1600,
          maxHeight: 1600,
          quality: 82,
          format: "webp"
        });

        const key = `user_photos/${userId}/photo_${Date.now()}_${i}.${optimized.ext}`;
        const imageUrl = await this.uploadBuffer(optimized.buffer, key, optimized.mime);

        await pool.execute(
          "INSERT INTO user_photos (user_id, image_url, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)",
          [userId, imageUrl]
        );
        uploadedUrls.push(imageUrl);
      } catch (err) {
        console.error("Cloudflare R2 Image upload failed:", err);
        errors[i] = "upload_failed";
      }
    }

    if (errors.length > 0 && uploadedUrls.length === 0) {
      return { success: 0, message: "Invalid image(s)", errors };
    }

    const [finalPhotos] = await pool.execute(
      "SELECT id, image_url FROM user_photos WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );

    return {
      success: 1,
      message: "Images updated successfully",
      data: finalPhotos
    };
  }

  /**
   * Uploads identity verification documents and profile photo with automatic optimization,
   * 70%+ Face Similarity verification, and Document OCR profile data matching.
   */
  async uploadDocuments(userId, documentType, profileB64, frontB64, backB64) {
    const vProfile = validateBase64Image(profileB64);
    const vFront = validateBase64Image(frontB64);
    const vBack = validateBase64Image(backB64);

    const errors = {};
    if (!vProfile.ok) errors.profile = vProfile.error;
    if (!vFront.ok) errors.front_side = vFront.error;
    if (!vBack.ok) errors.back_side = vBack.error;

    if (Object.keys(errors).length > 0) {
      return { success: 0, message: "Invalid image(s)", errors };
    }

    // 1. Fetch user's basic profile details from database
    const [userRows] = await pool.execute(
      "SELECT id, first_name, last_name, dob, gender, is_verified FROM users WHERE id = $1",
      [userId]
    );
    const userProfile = userRows[0] || {};

    // 2. Perform Face Similarity (>=70%) and Document OCR profile matching
    const verificationService = require("./verification.service");
    const verificationResult = await verificationService.verifyDocumentUpload(
      vProfile.buffer,
      vFront.buffer,
      userProfile
    );

    if (!verificationResult.is_verified) {
      return {
        success: 0,
        message: verificationResult.errors[0] || "Document verification failed",
        errors: verificationResult.errors,
        verification: {
          face_similarity: `${verificationResult.face_similarity_score}%`,
          face_match: verificationResult.face_match,
          name_match: verificationResult.name_match,
          dob_match: verificationResult.dob_match,
          gender_match: verificationResult.gender_match
        }
      };
    }

    // 3. Optimize images for documents and profile photo
    const [optProfile, optFront, optBack] = await Promise.all([
      optimizeImage(vProfile.buffer, { maxWidth: 1600, maxHeight: 1600, quality: 84, format: "webp" }),
      optimizeImage(vFront.buffer, { maxWidth: 1800, maxHeight: 1800, quality: 86, format: "webp" }),
      optimizeImage(vBack.buffer, { maxWidth: 1800, maxHeight: 1800, quality: 86, format: "webp" })
    ]);

    const timestamp = Date.now();
    const profileKey = `documents/${userId}/profile_${timestamp}.${optProfile.ext}`;
    const frontKey = `documents/${userId}/front_${timestamp}.${optFront.ext}`;
    const backKey = `documents/${userId}/back_${timestamp}.${optBack.ext}`;

    const profileUrl = await this.uploadBuffer(optProfile.buffer, profileKey, optProfile.mime);
    const frontUrl = await this.uploadBuffer(optFront.buffer, frontKey, optFront.mime);
    const backUrl = await this.uploadBuffer(optBack.buffer, backKey, optBack.mime);

    const [existing] = await pool.execute("SELECT id FROM user_document WHERE user_id = $1", [userId]);

    if (existing.length > 0) {
      await pool.execute(
        "UPDATE user_document SET document_type = $1, profile = $2, front_image = $3, back_image = $4 WHERE user_id = $5",
        [documentType, profileUrl, frontUrl, backUrl, userId]
      );
    } else {
      await pool.execute(
        "INSERT INTO user_document (user_id, document_type, profile, front_image, back_image) VALUES ($1, $2, $3, $4, $5)",
        [userId, documentType, profileUrl, frontUrl, backUrl]
      );
    }

    await pool.execute("UPDATE users SET document = true, is_verified = true WHERE id = $1", [userId]);

    return {
      success: 1,
      message: "Document verified and uploaded successfully",
      verification: {
        face_similarity: `${verificationResult.face_similarity_score}%`,
        face_match: verificationResult.face_match,
        name_match: verificationResult.name_match,
        dob_match: verificationResult.dob_match,
        gender_match: verificationResult.gender_match
      },
      data: {
        document_type: documentType,
        profile: profileUrl,
        front_image: frontUrl,
        back_image: backUrl
      }
    };
  }
}

module.exports = new CloudflareService();
