# API Migration Mapping

This document provides a detailed mapping between the original PHP file endpoints and the migrated Express.js routes.

| Original PHP File | Express.js Route | HTTP Method | Controller / Service | Auth Required | Multipart / Base64 | Database Tables Used |
|---|---|---|---|---|---|---|
| `login.php` | `POST /api/calls/login` | `POST` | `auth.controller` -> `authService.login` | No | Body (JSON) | `users` |
| `send_otp.php` | `POST /api/calls/send_otp` | `POST` | `auth.controller` -> `authService.sendOTP` | No | Body (JSON) | `user_otps` |
| `verify_otp.php` | `POST /api/calls/verify_otp` | `POST` | `auth.controller` -> `authService.verifyOTP` | No | Body (JSON) | `user_otps`, `users`, `user_subscriptions` |
| `logout_user.php` | `POST /api/calls/logout_user` | `POST` | `auth.controller` -> `authService.logout` | Yes | Body (JSON) | `users` |
| `delete_user.php` | `POST /api/calls/delete_user` | `POST` | `auth.controller` -> `authService.deleteAccount` | Yes | Body (JSON) | `users` |
| `get_profile_data.php` | `POST /api/calls/get_profile_data` | `POST` | `profile.controller` -> `profileService.getUserRow` | Yes | Body (JSON) | `users`, `physical_details`, `family_details`, `user_addresses`, `marital_professional_details`, `partner_preferences` |
| `my_profile.php` | `POST /api/calls/my_profile` | `POST` | `profile.controller` -> `profileService.getCompleteProfile` | Yes | Body (JSON) | `users`, `user_document`, `user_subscriptions`, `subscription_plans` |
| `manage_basic_details.php` | `POST /api/calls/manage_basic_details` | `POST` | `profile.controller` -> `profileService.updateBasicDetails` | Yes | Body (JSON) | `users` |
| `manage_family_details.php` | `POST /api/calls/manage_family_details` | `POST` | `profile.controller` -> `profileService.addFamilyDetails` | Yes | Body (JSON) | `family_details`, `users` |
| `manage_physical_details.php` | `POST /api/calls/manage_physical_details` | `POST` | `profile.controller` -> `profileService.addPhysicalDetails` | Yes | Body (JSON) | `physical_details`, `users` |
| `manage_marital_professional_details.php` | `POST /api/calls/manage_marital_professional_details` | `POST` | `profile.controller` -> `profileService.addMaritalDetails` | Yes | Body (JSON) | `marital_professional_details`, `users` |
| `manage_partner_preference.php` | `POST /api/calls/manage_partner_preference` | `POST` | `profile.controller` -> `profileService.savePartnerPreferences` | Yes | Body (JSON) | `partner_preferences`, `users` |
| `manage_address.php` | `POST /api/calls/manage_address` | `POST` | `profile.controller` -> `profileService.addOrUpdateAddress` | Yes | Body (JSON) | `user_addresses`, `users` |
| `view_profile.php` | `POST /api/calls/view_profile` | `POST` | `profile.controller` -> `profileService.getPartnerProfile` | Yes | Body (JSON) | `users`, `physical_details`, `family_details`, `marital_professional_details`, `partner_preferences`, `user_document`, `user_photos`, `interests`, `user_subscriptions` |
| `dashboard.php` | `POST /api/calls/dashboard` | `POST` | `user.controller` -> `userService.getDashboardProfiles` | Yes | Body (JSON) | `users`, `physical_details`, `marital_professional_details`, `user_addresses`, `user_document`, `interests`, `profile_views` |
| `report_user.php` | `POST /api/calls/report_user` | `POST` | `user.controller` -> `userService.reportUser` | Yes | Body (JSON) | `user_reports`, `users` |
| `manage_image.php` | `POST /api/calls/manage_image` | `POST` | `image.controller` -> `cloudinaryService.managePhotos` | Yes | Base64 Array | `user_photos` |
| `get_image.php` | `POST /api/calls/get_image` | `POST` | `image.controller` -> `profileService.getImages` | Yes | Body (JSON) | `user_photos` |
| `upload_document.php` | `POST /api/calls/upload_document` | `POST` | `document.controller` -> `cloudinaryService.uploadDocuments` | Yes | Base64 / Form | `user_document`, `users` |
| `send_intrest.php` | `POST /api/calls/send_intrest` | `POST` | `interest.controller` -> `interestService.manageInterest` | Yes | Body (JSON) | `interests`, `profile_views`, `notifications`, `users`, `user_subscriptions` |
| `manage_interest.php` | `POST /api/calls/manage_interest` | `POST` | `interest.controller` -> `interestService.manageInterest` | Yes | Body (JSON) | `interests`, `notifications`, `users`, `user_subscriptions` |
| `reject_intrest.php` | `POST /api/calls/reject_intrest` | `POST` | `interest.controller` -> `interestService.manageInterest` | Yes | Body (JSON) | `interests`, `notifications`, `users` |
| `interest_profile.php` | `POST /api/calls/interest_profile` | `POST` | `interest.controller` -> `interestService.getInterests` | Yes | Body (JSON) | `interests`, `users`, `user_document` |
| `notification_list.php` | `POST /api/calls/notification_list` | `POST` | `notification.controller` -> `notificationService.getNotifications` | Yes | Body (JSON) | `notifications` |
| `get_plan.php` | `POST /api/calls/get_plan` | `POST` | `subscription.controller` -> `subscriptionService.getPlans` | Yes | Body (JSON) | `subscription_plans` |
| `create_order.php` | `POST /api/calls/create_order` | `POST` | `subscription.controller` -> `subscriptionService.createOrder` | Yes | Body (JSON) | `subscription_plans`, `subscription_payments` |
| `subscribe_plan.php` | `POST /api/calls/subscribe_plan` | `POST` | `subscription.controller` -> `subscriptionService.subscribePlan` | Yes | Body (JSON) | `subscription_payments`, `subscription_plans`, `user_subscriptions` |
| `subscribe_history.php` | `POST /api/calls/subscribe_history` | `POST` | `subscription.controller` -> `subscriptionService.getPaymentHistory` | Yes | Body (JSON) | `subscription_payments`, `subscription_plans` |
| `cancel_order.php` | `POST /api/calls/cancel_order` | `POST` | `subscription.controller` -> `subscriptionService.cancelOrder` | Yes | Body (JSON) | `subscription_payments` |
| `get_states.php` | `GET/POST /api/calls/get_states` | `ALL` | `location.controller` -> `masterRepository.getStates` | No | Any | `states` |
| `get_districts.php` | `GET/POST /api/calls/get_districts` | `ALL` | `location.controller` -> `masterRepository.getDistricts` | No | Any | `districts` |
| `get_cities.php` | `GET/POST /api/calls/get_cities` | `ALL` | `location.controller` -> `masterRepository.getCities` | No | Any | `cities` |
| `get_sub_castes.php` | `GET/POST /api/calls/get_sub_castes` | `ALL` | `location.controller` -> `masterRepository.getSubCastes` | No | Any | `sub_castes` |
