const cloudinary = require("../config/cloudinary");
const pool = require("../config/database");
const { validateBase64Image } = require("../utils/validation");

class CloudinaryService {
  async uploadBuffer(buffer, folder, publicId) {
    return new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: folder,
          public_id: publicId,
          resource_type: "image"
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    });
  }

  async deleteAsset(publicId) {
    try {
      if (publicId) {
        await cloudinary.uploader.destroy(publicId);
      }
    } catch (err) {
      console.error("Cloudinary asset deletion error:", err);
    }
  }

  async managePhotos(userId, existingImages = [], newImages = []) {
    if (!Array.isArray(existingImages)) existingImages = [];
    if (!Array.isArray(newImages)) newImages = [];

    if (existingImages.length + newImages.length > 5) {
      return { success: false, message: "Maximum 5 images are allowed" };
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
      }
    }

    // 2. Validate and upload new base64 images
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
        const publicId = `user_${userId}_photo_${Date.now()}_${i}`;
        let imageUrl = "";

        if (process.env.CLOUDINARY_CLOUD_NAME) {
          const res = await this.uploadBuffer(valid.buffer, `user_photos/${userId}`, publicId);
          imageUrl = res.secure_url;
        } else {
          imageUrl = `https://res.cloudinary.com/demo/image/upload/v1/user_photos/${userId}/${publicId}.${valid.ext}`;
        }

        await pool.execute(
          "INSERT INTO user_photos (user_id, image_url, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP)",
          [userId, imageUrl]
        );
        uploadedUrls.push(imageUrl);
      } catch (err) {
        console.error("Image upload failed:", err);
        errors[i] = "upload_failed";
      }
    }

    if (errors.length > 0 && uploadedUrls.length === 0) {
      return { success: false, message: "Invalid image(s)", errors };
    }

    const [finalPhotos] = await pool.execute(
      "SELECT id, image_url FROM user_photos WHERE user_id = $1 ORDER BY id ASC",
      [userId]
    );

    return {
      success: true,
      message: "Images updated successfully",
      data: finalPhotos
    };
  }

  async uploadDocuments(userId, documentType, profileB64, frontB64, backB64) {
    const vProfile = validateBase64Image(profileB64);
    const vFront = validateBase64Image(frontB64);
    const vBack = validateBase64Image(backB64);

    const errors = {};
    if (!vProfile.ok) errors.profile = vProfile.error;
    if (!vFront.ok) errors.front_side = vFront.error;
    if (!vBack.ok) errors.back_side = vBack.error;

    if (Object.keys(errors).length > 0) {
      return { success: false, message: "Invalid image(s)", errors };
    }

    let profileUrl = "", frontUrl = "", backUrl = "";
    const folder = `documents/${userId}`;

    if (process.env.CLOUDINARY_CLOUD_NAME) {
      const pRes = await this.uploadBuffer(vProfile.buffer, folder, "profile");
      const fRes = await this.uploadBuffer(vFront.buffer, folder, "front");
      const bRes = await this.uploadBuffer(vBack.buffer, folder, "back");
      profileUrl = pRes.secure_url;
      frontUrl = fRes.secure_url;
      backUrl = bRes.secure_url;
    } else {
      profileUrl = `https://res.cloudinary.com/demo/image/upload/v1/${folder}/profile.${vProfile.ext}`;
      frontUrl = `https://res.cloudinary.com/demo/image/upload/v1/${folder}/front.${vFront.ext}`;
      backUrl = `https://res.cloudinary.com/demo/image/upload/v1/${folder}/back.${vBack.ext}`;
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

    await pool.execute("UPDATE users SET document = 1 WHERE id = $1", [userId]);

    return {
      success: true,
      message: "Uploaded successfully"
    };
  }
}

module.exports = new CloudinaryService();
