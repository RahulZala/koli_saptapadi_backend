const crypto = require("crypto");
const env = require("../config/env");
const notificationRepository = require("../repositories/notification.repository");

let cachedAccessToken = null;
let accessTokenExpiresAt = 0;

class NotificationService {
  async createAndSendNotification(senderId, receiverId, title, message, type, referenceId) {
    await notificationRepository.createNotification(senderId, receiverId, title, message, type, referenceId);

    const receiverToken = await notificationRepository.getUserFcmToken(receiverId);
    const fcmToken = env.NODE_ENV === "development" && env.FCM_TEST_DEVICE_TOKEN
      ? env.FCM_TEST_DEVICE_TOKEN
      : receiverToken;
    if (fcmToken) {
      try {
        await this.sendFCMPushNotification(fcmToken, title, message);
      } catch (err) {
        console.error(`[notifications] FCM delivery failed for recipient ${receiverId}: ${err.message}`);
      }
    }
  }

  async sendFCMPushNotification(token, title, body) {
    const accessToken = await this.getFirebaseAccessToken();
    const response = await fetch(
      `https://fcm.googleapis.com/v1/projects/${encodeURIComponent(env.FIREBASE_PROJECT_ID)}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          message: {
            token,
            notification: { title, body }
          }
        })
      }
    );

    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Firebase Cloud Messaging returned ${response.status}: ${details}`);
    }
  }

  async getFirebaseAccessToken() {
    if (cachedAccessToken && accessTokenExpiresAt > Date.now()) {
      return cachedAccessToken;
    }

    if (!env.FIREBASE_PROJECT_ID || !env.FIREBASE_CLIENT_EMAIL || !env.FIREBASE_PRIVATE_KEY) {
      throw new Error("Firebase service-account credentials are not configured");
    }

    const now = Math.floor(Date.now() / 1000);
    const encode = (value) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const unsignedAssertion = [
      encode({ alg: "RS256", typ: "JWT" }),
      encode({
        iss: env.FIREBASE_CLIENT_EMAIL,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
        iat: now,
        exp: now + 3600
      })
    ].join(".");
    const signature = crypto
      .createSign("RSA-SHA256")
      .update(unsignedAssertion)
      .end()
      .sign(env.FIREBASE_PRIVATE_KEY)
      .toString("base64url");
    const assertion = `${unsignedAssertion}.${signature}`;
    const response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
        assertion
      })
    });

    const result = await response.json();
    if (!response.ok || !result.access_token) {
      throw new Error(`Firebase authorization failed (${response.status}): ${result.error_description || result.error || "No access token returned"}`);
    }

    cachedAccessToken = result.access_token;
    accessTokenExpiresAt = Date.now() + Math.max((result.expires_in - 60) * 1000, 0);
    return cachedAccessToken;
  }

  async getNotifications(userId, page = 1, limit = 10) {
    await notificationRepository.markAllAsRead(userId);
    const data = await notificationRepository.getNotificationList(userId, parseInt(page, 10), parseInt(limit, 10));
    return {
      success: 1,
      data
    };
  }

  async getUnreadCount(userId) {
    return {
      success: 1,
      data: { unread_count: await notificationRepository.getUnreadCount(userId) }
    };
  }
}

module.exports = new NotificationService();
