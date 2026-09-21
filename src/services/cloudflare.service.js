const { PutObjectCommand, DeleteObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { getSignedUrl } = require("@aws-sdk/s3-request-presigner");
const { r2Client, bucketName, publicUrl, isLive } = require("../config/cloudflare");
const pool = require("../config/database");
const { validateBase64Image, resolveImageInput } = require("../utils/validation");
const { optimizeImage } = require("../utils/imageOptimizer");

class CloudflareService {
  /**
   * Generates a presigned PUT URL for direct client-to-Cloudflare R2 upload (bypassing Vercel's 4.5MB limit).
   */
  async getPresignedUploadUrl(userId, folder = "documents", filename = null, mimeType = "image/jpeg", expiresIn = 900) {
    const timestamp = Date.now();
    const ext = mimeType === "image/png" ? "png" : mimeType === "image/webp" ? "webp" : "jpg";
    const cleanFilename = filename
      ? `${timestamp}_${filename.replace(/[^a-zA-Z0-9._-]/g, "_")}`
      : `${timestamp}.${ext}`;
    const key = `${folder}/${userId}/${cleanFilename}`;

    const baseUrl = publicUrl ? publicUrl.replace(/\/+$/, "") : `https://${bucketName || "pub-storage"}.r2.dev`;
    const filePublicUrl = `${baseUrl}/${key}`;

    if (isLive && r2Client && bucketName) {
      const command = new PutObjectCommand({
        Bucket: bucketName,
        Key: key,
        ContentType: mimeType
      });
      const uploadUrl = await getSignedUrl(r2Client, command, { expiresIn });
      return {
        key,
        upload_url: uploadUrl,
        public_url: filePublicUrl,
        expires_in: expiresIn,
        method: "PUT",
        headers: {
          "Content-Type": mimeType
        }
      };
    }

    // Debug / Mock Mode
    return {
      key,
      upload_url: filePublicUrl,
      public_url: filePublicUrl,
      expires_in: expiresIn,
      method: "PUT",
      headers: {
        "Content-Type": mimeType
      }
    };
  }

  /**
   * Generates batch presigned upload URLs for document verification images (profile, front, back).
   */
  async getDocumentUploadUrls(userId) {
    const [profile, front, back] = await Promise.all([
      this.getPresignedUploadUrl(userId, "documents", "profile.jpg", "image/jpeg"),
      this.getPresignedUploadUrl(userId, "documents", "front_side.jpg", "image/jpeg"),
      this.getPresignedUploadUrl(userId, "documents", "back_side.jpg", "image/jpeg")
    ]);

    return {
      success: 1,
      message: "Presigned upload URLs generated successfully",
      data: {
        profile,
        front_side: front,
        back_side: back
      }
    };
  }

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
   * Manages user gallery photos (up to 5 images max) supporting both Base64 and direct R2 URLs.
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

    // 2. Process new images (Base64 strings or direct R2 URLs)
    const uploadedUrls = [];
    const errors = [];

    for (let i = 0; i < newImages.length; i++) {
      const item = newImages[i];
      const resolved = await resolveImageInput(item);

      if (!resolved.ok) {
        errors[i] = resolved.error;
        continue;
      }

      try {
        let finalImageUrl;

        if (resolved.isUrl) {
          // Image already uploaded directly to Cloudflare R2 via presigned URL
          finalImageUrl = resolved.url;
        } else {
          // Base64 image: optimize and upload to R2
          const optimized = await optimizeImage(resolved.buffer, {
            maxWidth: 1600,
            maxHeight: 1600,
            quality: 82,
            format: "webp"
          });

          const key = `user_photos/${userId}/photo_${Date.now()}_${i}.${optimized.ext}`;
          finalImageUrl = await this.uploadBuffer(optimized.buffer, key, optimized.mime);
        }

        await pool.execute(
          "INSERT INTO user_photos (user_id, image_url, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)",
          [userId, finalImageUrl]
        );
        uploadedUrls.push(finalImageUrl);
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
   * Uploads identity verification documents and profile photo supporting both direct R2 URLs and Base64 strings.
   * Performs 70%+ Face Similarity verification and Document OCR profile data matching.
   */
  async uploadDocuments(userId, documentType, profileInput, frontInput, backInput) {
    const [vProfile, vFront, vBack] = await Promise.all([
      resolveImageInput(profileInput),
      resolveImageInput(frontInput),
      resolveImageInput(backInput)
    ]);

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

    // 3. Determine URLs (if already uploaded directly to R2, use URLs; if Base64, optimize & upload)
    let profileUrl, frontUrl, backUrl;

    if (vProfile.isUrl && vFront.isUrl && vBack.isUrl) {
      profileUrl = vProfile.url;
      frontUrl = vFront.url;
      backUrl = vBack.url;
    } else {
      const [optProfile, optFront, optBack] = await Promise.all([
        vProfile.isUrl
          ? Promise.resolve({ url: vProfile.url })
          : optimizeImage(vProfile.buffer, { maxWidth: 1600, maxHeight: 1600, quality: 84, format: "webp" }),
        vFront.isUrl
          ? Promise.resolve({ url: vFront.url })
          : optimizeImage(vFront.buffer, { maxWidth: 1800, maxHeight: 1800, quality: 86, format: "webp" }),
        vBack.isUrl
          ? Promise.resolve({ url: vBack.url })
          : optimizeImage(vBack.buffer, { maxWidth: 1800, maxHeight: 1800, quality: 86, format: "webp" })
      ]);

      const timestamp = Date.now();
      const profileKey = `documents/${userId}/profile_${timestamp}.${optProfile.ext || "webp"}`;
      const frontKey = `documents/${userId}/front_${timestamp}.${optFront.ext || "webp"}`;
      const backKey = `documents/${userId}/back_${timestamp}.${optBack.ext || "webp"}`;

      profileUrl = optProfile.url || (await this.uploadBuffer(optProfile.buffer, profileKey, optProfile.mime));
      frontUrl = optFront.url || (await this.uploadBuffer(optFront.buffer, frontKey, optFront.mime));
      backUrl = optBack.url || (await this.uploadBuffer(optBack.buffer, backKey, optBack.mime));
    }

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
