# DriveThrough --- Complete Feature-wise Documentation

# Feature 01 --- Authentication and Account Management

## 1. Objective

Provide secure registration, verification, login, session management,
account recovery and role-based access for consumers, drivers and
platform staff.

## 2. Actors

-   Guest
-   Consumer
-   Professional driver
-   Admin users

## 3. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  AUTH-001                Register with a unique  P0
                          phone number and/or     
                          email address           

  AUTH-002                Verify phone/email      P0
                          using OTP or            
                          verification link       

  AUTH-003                Login using configured  P0
                          credentials or          
                          passwordless method     

  AUTH-004                Issue short-lived       P0
                          access tokens and       
                          rotate refresh tokens   

  AUTH-005                Enforce role-based      P0
                          authorization for APIs  
                          and screens             

  AUTH-006                Support logout and      P1
                          session revocation      

  AUTH-007                Support secure password P0
                          reset/account recovery  

  AUTH-008                Rate-limit login,       P0
                          registration, OTP and   
                          recovery endpoints      

  AUTH-009                Allow users to update   P1
                          contact details with    
                          re-verification         
  -----------------------------------------------------------------------

## 4. User flow

1.  User chooses Consumer or Driver registration.
2.  User enters phone/email and required credentials.
3.  System validates uniqueness and sends a verification code/link.
4.  User verifies the contact channel.
5.  System creates or activates the account and assigns the selected
    role.
6.  User completes the relevant profile onboarding.
7.  User logs in and receives a session.
8.  On logout, refresh credentials are revoked.

## 5. Business rules

-   A phone number/email must not be assigned to multiple active
    accounts unless the product explicitly supports shared identities.
-   Role selection during registration must not grant administrative
    privileges.
-   Admin roles can only be assigned by an authorised super admin.
-   Access tokens must expire; refresh tokens must be revocable and
    rotated.
-   OTPs must be time-limited, single-use and rate-limited.
-   Error messages must not reveal whether an email or phone number is
    registered.
-   Suspended users cannot create bookings or accept trips.

## 6. Suggested API endpoints

  Method   Endpoint                         Purpose
  -------- -------------------------------- ------------------------
  POST     `/api/v1/auth/register`          Create account
  POST     `/api/v1/auth/verify-otp`        Verify phone/email
  POST     `/api/v1/auth/login`             Authenticate
  POST     `/api/v1/auth/refresh`           Refresh session
  POST     `/api/v1/auth/logout`            Revoke current session
  POST     `/api/v1/auth/logout-all`        Revoke all sessions
  POST     `/api/v1/auth/forgot-password`   Start recovery
  POST     `/api/v1/auth/reset-password`    Complete recovery
  GET      `/api/v1/auth/me`                Get current user

## 7. Data entities

### `users`

-   `id`
-   `email`
-   `phone`
-   `password_hash` (if password authentication is used)
-   `role`
-   `account_status`
-   `email_verified_at`
-   `phone_verified_at`
-   `created_at`
-   `updated_at`

### `user_sessions`

-   `id`
-   `user_id`
-   `refresh_token_hash`
-   `expires_at`
-   `revoked_at`
-   `device_metadata`
-   `created_at`

## 8. Acceptance criteria

-   Duplicate phone/email registration is rejected.
-   Invalid or expired OTP is rejected.
-   Refresh token rotation works and revoked tokens cannot be reused.
-   Consumer cannot call driver-only or admin-only endpoints.
-   Driver cannot grant themselves approved KYC status.
-   Suspended accounts cannot perform restricted actions.

## 9. Security considerations

Use Argon2id or appropriately configured bcrypt for password hashing.
Use HTTPS, secure cookies where applicable, CSRF protection for
cookie-based sessions, strict CORS, rate limiting and audit logging.
Never store plaintext passwords or OTPs.

------------------------------------------------------------------------

# Feature 02 --- Consumer Profile and Vehicle Management

## 1. Objective

Allow consumers to maintain the information required to book a
professional driver for their own vehicle.

## 2. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  CON-001                 Create and update       P0
                          consumer name and       
                          contact details         

  CON-002                 Capture                 P1
                          identity-verification   
                          details according to    
                          policy                  

  CON-003                 Add, edit and           P0
                          deactivate vehicle      
                          profiles                

  CON-004                 Save pickup/home/work   P1
                          locations               

  CON-005                 Save emergency contact  P1
                          details                 

  CON-006                 View own booking        P0
                          history and booking     
                          details                 

  CON-007                 Manage notification     P2
                          preferences             
  -----------------------------------------------------------------------

## 3. Consumer profile fields

-   Full name
-   Verified phone number
-   Verified email (where required)
-   Address (optional unless required by policy)
-   Profile photo (optional)
-   Identity verification status
-   Emergency contact name and phone
-   Created and updated timestamps

## 4. Vehicle profile fields

-   Vehicle make
-   Vehicle model
-   Vehicle category/type
-   Transmission: manual or automatic
-   Fuel type (optional)
-   Registration number/reference (collect only if operationally
    necessary)
-   Special instructions (for example, vehicle controls or known
    handling notes)

## 5. User flow

1.  Consumer opens Profile.
2.  Consumer updates personal details.
3.  Consumer adds a vehicle.
4.  Consumer selects a saved vehicle while planning a trip.
5.  Consumer can update or deactivate the vehicle later.

## 6. Business rules

-   Consumers can access only their own profile and vehicle records.
-   Vehicle information must not be exposed to drivers until required
    for an accepted booking.
-   A deactivated vehicle cannot be selected for a new booking.
-   Identity verification requirements must be configurable by market
    and launch policy.
-   Collect the minimum personal and vehicle data needed for the
    service.

## 7. Suggested API endpoints

  --------------------------------------------------------------------------------
  Method            Endpoint                                     Purpose
  ----------------- -------------------------------------------- -----------------
  GET               `/api/v1/consumers/me`                       Get own profile

  PATCH             `/api/v1/consumers/me`                       Update profile

  GET               `/api/v1/consumers/me/vehicles`              List vehicles

  POST              `/api/v1/consumers/me/vehicles`              Add vehicle

  PATCH             `/api/v1/consumers/me/vehicles/:vehicleId`   Update vehicle

  DELETE            `/api/v1/consumers/me/vehicles/:vehicleId`   Deactivate
                                                                 vehicle

  PUT               `/api/v1/consumers/me/emergency-contact`     Save emergency
                                                                 contact
  --------------------------------------------------------------------------------

## 8. Data entities

### `consumer_profiles`

`user_id`, `full_name`, `address`, `identity_status`,
`emergency_contact_name`, `emergency_contact_phone`, timestamps.

### `vehicles`

`id`, `consumer_id`, `make`, `model`, `vehicle_type`, `transmission`,
`fuel_type`, `registration_reference`, `notes`, `status`, timestamps.

## 9. Acceptance criteria

-   Consumer can create, update and deactivate a vehicle.
-   Consumer cannot access another consumer's vehicle.
-   Inactive vehicles are excluded from trip planning.
-   Required verification status is checked before the relevant booking
    action.

------------------------------------------------------------------------

# Feature 03 --- Driver Onboarding and KYC

## 1. Objective

Onboard professional drivers and ensure that only appropriately reviewed
and approved drivers can appear in consumer search results.

## 2. Driver onboarding steps

1.  Create account and verify phone/email.
2.  Enter personal details.
3.  Add profile photo and professional information.
4.  Enter driving licence details.
5.  Upload configured identity and driving documents.
6.  Add experience, languages and other profile information.
7.  Select operating states and service preferences.
8.  Set rate and availability.
9.  Submit profile for review.
10. Receive approved, rejected or resubmission status.

## 3. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  DRV-001                 Create and edit driver  P0
                          profile                 

  DRV-002                 Enter licence details   P0
                          and upload required     
                          documents               

  DRV-003                 Support dummy KYC in    P0
                          non-production          
                          environments only       

  DRV-004                 Reviewer can approve,   P0
                          reject or request       
                          resubmission            

  DRV-005                 Capture document expiry P1
                          dates where applicable  

  DRV-006                 Notify driver when      P0
                          verification status     
                          changes                 

  DRV-007                 Show onboarding         P1
                          completion checklist    

  DRV-008                 Suspend or reactivate   P0
                          driver through          
                          authorised admin        
                          workflow                
  -----------------------------------------------------------------------

## 4. Verification statuses

-   `not_submitted`
-   `pending_review`
-   `needs_resubmission`
-   `approved`
-   `rejected`
-   `expired`
-   `suspended`

A driver profile can be complete while verification is pending. Profile
completion must not be treated as verification approval.

## 5. Dummy KYC policy

Dummy KYC is permitted only for local development, automated tests,
demos or controlled staging. Test records must be visibly labelled as
synthetic. Production must reject test-mode documents and must not treat
dummy approval as genuine identity or licence verification.

## 6. Document handling

-   Use private Supabase Storage buckets.
-   Validate file type and size.
-   Store object keys, not public URLs.
-   Use short-lived signed URLs for authorised review.
-   Restrict document access to the driver and authorised reviewers.
-   Record reviewer, decision, timestamp and reason.
-   Define retention and deletion policy before launch.

## 7. Suggested API endpoints

  ---------------------------------------------------------------------------------
  Method             Endpoint                                    Purpose
  ------------------ ------------------------------------------- ------------------
  GET                `/api/v1/drivers/me/onboarding`             Get onboarding
                                                                 state

  PATCH              `/api/v1/drivers/me/profile`                Update profile

  POST               `/api/v1/drivers/me/documents`              Register uploaded
                                                                 document

  GET                `/api/v1/drivers/me/documents`              List own document
                                                                 statuses

  GET                `/api/v1/admin/drivers`                     List drivers for
                                                                 review

  POST               `/api/v1/admin/drivers/:driverId/review`    Record review
                                                                 decision

  POST               `/api/v1/admin/drivers/:driverId/suspend`   Suspend driver
  ---------------------------------------------------------------------------------

## 8. Data entities

### `driver_profiles`

`user_id`, `full_name`, `date_of_birth` (only if required),
`profile_photo_key`, `experience_years`, `languages`, `approval_status`,
timestamps.

### `driver_documents`

`id`, `driver_id`, `document_type`, `storage_key`,
`verification_status`, `document_number_encrypted` (if retained),
`expiry_date`, `reviewer_id`, `review_reason`, timestamps.

## 9. Acceptance criteria

-   New drivers are not searchable until approved and active.
-   Reviewer decisions require a reason.
-   Driver receives a notification after a decision.
-   Expired required credentials make the driver ineligible according to
    policy.
-   Production cannot approve dummy KYC records.

------------------------------------------------------------------------

# Feature 04 --- Driver Preferences, Rates and Availability

## 1. Objective

Give drivers control over where, when and for which types of trips they
are willing to work.

## 2. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  PREF-001                Driver can select       P0
                          multiple operating      
                          states                  

  PREF-002                Driver can optionally   P1
                          select cities/districts 
                          within selected states  

  PREF-003                Driver can choose       P0
                          one-way and/or          
                          round-trip preferences  

  PREF-004                Driver can set hourly   P0
                          rate                    

  PREF-005                Driver can set minimum  P0
                          billable hours          

  PREF-006                Driver can set waiting  P1
                          rate and other optional 
                          charges                 

  PREF-007                Driver can set          P0
                          availability windows    
                          and blocked dates       

  PREF-008                Driver can toggle       P0
                          bookable status         

  PREF-009                Driver can set vehicle  P1
                          transmission/category   
                          preferences             
  -----------------------------------------------------------------------

## 3. State preference rules

-   A driver may select more than one state.
-   A driver must select at least one active service state before
    becoming searchable.
-   The backend must compare the route's required state coverage with
    the driver's selected states.
-   For interstate routes, the recommended default is that the driver
    must have selected every state traversed by the route.
-   If the route-state result is uncertain, do not silently assume
    eligibility; use a safe fallback or manual operations review.
-   State and city lists should come from a centrally managed reference
    table, not hard-coded frontend values.

## 4. Rate card

Fields: - Hourly rate - Minimum billable hours - Waiting rate per hour -
Optional overnight/day allowance - Effective date/version

Rates must be within admin-configured limits. A rate change applies to
new quotes only. Existing quote snapshots must remain unchanged.

## 5. Availability rules

-   Driver can set recurring weekly availability and one-off blocked
    periods.
-   Confirmed bookings reserve the relevant time window.
-   Include configurable pickup travel and turnaround buffers.
-   Driver must not be offered for overlapping confirmed bookings.
-   Driver can mark themselves unavailable at any time, but this must
    not silently cancel already confirmed trips.

## 6. Suggested API endpoints

  --------------------------------------------------------------------------------
  Method              Endpoint                               Purpose
  ------------------- -------------------------------------- ---------------------
  PUT                 `/api/v1/drivers/me/service-areas`     Replace/update
                                                             selected states

  PUT                 `/api/v1/drivers/me/preferences`       Update trip/vehicle
                                                             preferences

  PUT                 `/api/v1/drivers/me/rate-card`         Update rates

  GET                 `/api/v1/drivers/me/availability`      Get availability

  PUT                 `/api/v1/drivers/me/availability`      Set availability

  PUT                 `/api/v1/drivers/me/bookable-status`   Activate/deactivate
                                                             bookable status
  --------------------------------------------------------------------------------

## 7. Data entities

-   `driver_service_areas`: driver, state code, optional city code,
    active flag.
-   `driver_rate_cards`: driver, hourly rate, minimum hours, waiting
    rate, effective dates.
-   `driver_availability`: driver, start time, end time, status.
-   `driver_preferences`: trip types, vehicle types, transmission,
    long-distance preference.

## 8. Acceptance criteria

-   Driver can select multiple states and remove a state.
-   Inactive state preferences do not qualify the driver for matching.
-   Rate validation rejects values outside configured limits.
-   Driver is excluded when unavailable or already assigned to an
    overlapping trip.

------------------------------------------------------------------------

# Feature 05 --- Location and Google Maps Integration

## 1. Objective

Allow consumers to select accurate pickup/drop locations and calculate
route distance and estimated duration for driver matching and fare
estimation.

## 2. Google Maps capabilities

Use the appropriate Google Maps Platform services for: - Places
autocomplete and place details - Geocoding where needed - Routes or
route matrix/distance-duration calculations - Map display and route
visualisation

Confirm current Google Maps product names, pricing, terms and regional
availability before implementation.

## 3. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  MAP-001                 Provide pickup and drop P0
                          autocomplete            

  MAP-002                 Resolve selected        P0
                          locations to address,   
                          coordinates and place   
                          ID where available      

  MAP-003                 Calculate route         P0
                          distance and duration   
                          on the backend          

  MAP-004                 Validate pickup and     P0
                          drop are distinct       

  MAP-005                 Determine route states  P1
                          where technically       
                          reliable                

  MAP-006                 Handle quota, timeout   P0
                          and provider errors     

  MAP-007                 Recalculate when route  P1
                          or scheduled time       
                          changes materially      
  -----------------------------------------------------------------------

## 4. Route estimate response

Suggested internal response:

``` json
{
  "pickup": {
    "formattedAddress": "Pickup address",
    "latitude": 17.0001,
    "longitude": 78.0001,
    "placeId": "provider-place-id"
  },
  "drop": {
    "formattedAddress": "Drop address",
    "latitude": 18.0001,
    "longitude": 79.0001,
    "placeId": "provider-place-id"
  },
  "distanceMeters": 250000,
  "durationSeconds": 14400,
  "estimatedAt": "2026-11-16T10:00:00Z",
  "provider": "google"
}
```

This is an illustrative application response, not a direct Google API
response.

## 5. Business rules

-   Maps API keys must be restricted by application and API.
-   Server-side keys must never be embedded in React.
-   Do not generate a fare when route calculation fails unless an
    authorised manual-quote process is explicitly supported.
-   Distance and duration are estimates, not guarantees.
-   Store the estimate timestamp and relevant provider metadata.
-   If the route crosses multiple states, use a reliable route-state
    method or an operationally approved fallback.

## 6. Suggested API endpoints

  ----------------------------------------------------------------------------
  Method              Endpoint                             Purpose
  ------------------- ------------------------------------ -------------------
  POST                `/api/v1/routes/estimate`            Calculate route

  GET                 `/api/v1/locations/suggestions`      Optional backend
                                                           autocomplete proxy

  POST                `/api/v1/routes/validate-coverage`   Evaluate
                                                           route-state
                                                           coverage
  ----------------------------------------------------------------------------

## 7. Acceptance criteria

-   Valid place selections return coordinates and formatted addresses.
-   Backend returns distance and duration in standard units.
-   Invalid or identical locations are handled according to trip policy.
-   Maps failures produce a retryable error and never a fabricated
    price.

------------------------------------------------------------------------

# Feature 06 --- Driver Search and Matching

## 1. Objective

Find drivers who are genuinely eligible for a requested trip and present
them to the consumer with useful comparison information.

## 2. Search inputs

-   Pickup location
-   Drop location
-   Trip type: one-way or round-trip
-   Scheduled pickup date/time
-   Expected duration or return date/time for round-trip
-   Consumer vehicle profile
-   Optional preferences such as language or transmission

## 3. Hard eligibility filters

A driver must: 1. Have an active account. 2. Have approved required
KYC/credential checks. 3. Be marked bookable. 4. Have service-area
coverage for the route. 5. Support the requested trip type and vehicle
requirements. 6. Be available for the complete estimated booking window
plus buffers. 7. Not have a conflicting confirmed booking.

## 4. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  SRCH-001                Consumer can search     P0
                          using complete trip     
                          criteria                

  SRCH-002                Exclude unapproved,     P0
                          inactive and suspended  
                          drivers                 

  SRCH-003                Match selected states   P0
                          to route coverage       

  SRCH-004                Exclude unavailable and P0
                          conflicting drivers     

  SRCH-005                Match trip and vehicle  P0
                          preferences             

  SRCH-006                Display rate, profile,  P0
                          rating and verification 
                          indicator               

  SRCH-007                Show a clear no-results P0
                          state                   

  SRCH-008                Support configurable    P1
                          result ranking          
  -----------------------------------------------------------------------

## 5. Suggested ranking

Apply hard eligibility filters first. Then rank eligible drivers using
configurable factors: - Availability fit - Distance/time to pickup -
Rating and completed-trip history - Acceptance/reliability rate - Rate
or estimated total - Consumer preferences

Do not let ranking override safety, credential, route-coverage or
availability filters. Avoid opaque or discriminatory ranking criteria.

## 6. Driver result card

Show: - Driver display name and profile photo - Experience - Languages -
Rating and number of completed reviews - Verification status indicator
(not document details) - Hourly rate - Estimated fare range/total, if
calculated - Trip-type compatibility - Relevant service coverage

## 7. Suggested API

`POST /api/v1/search/drivers`

Request should contain trip criteria and vehicle ID. The backend should
resolve the route and determine eligibility; do not trust
client-supplied distance, duration or driver eligibility.

## 8. Acceptance criteria

-   Ineligible drivers never appear.
-   A driver cannot be shown as confirmed before accepting.
-   No-results state offers useful next actions, such as changing time
    or route.
-   Search is revalidated when the consumer requests a booking.

------------------------------------------------------------------------

# Feature 07 --- Pricing and Fare Engine

## 1. Objective

Calculate transparent estimates for one-way and round-trip driver
services using driver hourly rates, route duration, waiting time and the
platform fee.

## 2. Pricing inputs

-   Driver hourly rate
-   Minimum billable hours
-   Google Maps estimated driving duration
-   Configured time buffer
-   Trip type
-   One-way return/deadhead policy
-   Round-trip return duration
-   Destination waiting duration
-   Waiting rate
-   Platform fee percentage (initially 10%)
-   Taxes and pass-through charges where applicable
-   Quote expiry and pricing-rule version

## 3. Recommended pricing components

### Driver service subtotal

`billable_hours × driver_hourly_rate`

Billable hours should be calculated using a documented rounding rule and
minimum duration.

### One-way trip

The driver takes the consumer's vehicle from pickup to drop. The driver
may need to travel back to their home/base without the consumer's
vehicle.

Recommended model:

`one_way_driver_subtotal = outbound_service_fare + disclosed_return_compensation`

Return compensation may be calculated using a configured return-to-base
time estimate, a fixed uplift or another agreed policy. The app must
disclose which method is used. Do not assume the driver's home location
or charge an undisclosed multiplier.

### Round-trip

`round_trip_driver_subtotal = outbound_fare + return_fare + waiting_charge`

If the driver waits at the destination, waiting duration and rate must
be clear. If the return is scheduled for another day, treat the booking
as a multi-period service and define driver accommodation, overnight and
availability policies.

### Platform fee

Initial proposal:

`platform_fee = fee_base × 10%`

`consumer_total = driver_service_subtotal + platform_fee + applicable taxes/pass-through charges`

This is only the recommended commercial interpretation. Confirm whether
the 10% is added to the consumer's bill or deducted from the driver's
earnings. Also confirm the exact fee base and tax treatment.

## 4. Functional requirements

  -------------------------------------------------------------------------
  ID                    Requirement                   Priority
  --------------------- ----------------------------- ---------------------
  FARE-001              Calculate billable hours from P0
                        route duration and configured 
                        buffer                        

  FARE-002              Apply driver's hourly rate    P0
                        and minimum hours             

  FARE-003              Calculate and disclose        P0
                        one-way return compensation   

  FARE-004              Calculate round-trip          P0
                        outbound, return and waiting  
                        components                    

  FARE-005              Add configurable 10% platform P0
                        fee as separate line item     

  FARE-006              Identify tolls, parking,      P1
                        taxes and other charges as    
                        included/excluded/estimated   

  FARE-007              Persist a complete quote      P0
                        snapshot                      

  FARE-008              Expire quotes and recalculate P0
                        after material changes        

  FARE-009              Require consent for permitted P1
                        material fare increases       
  -------------------------------------------------------------------------

## 5. Example calculation (illustrative only)

Assume: - Driver hourly rate: ₹300 - Minimum billable hours: 4 -
Estimated outbound time: 5 hours - One-way return compensation: 3
hours - Platform fee: 10% of driver service subtotal

Then: - Outbound fare = 5 × ₹300 = ₹1,500 - Return compensation = 3 ×
₹300 = ₹900 - Driver service subtotal = ₹2,400 - Platform fee = ₹240 -
Illustrative consumer total = ₹2,640, before any applicable taxes or
pass-through costs

The actual policy must specify whether return compensation is
time-based, fixed or otherwise calculated.

## 6. Quote display

Show: - Trip type - Route distance and estimated duration - Driver
hourly rate - Billable hours and minimum-hour adjustment - Outbound
fare - Return compensation (one-way) or return fare (round-trip) -
Waiting charges - Platform fee - Taxes and pass-through charges - Total
estimate - Exclusions and quote expiry

## 7. Data model

### `booking_quotes`

-   `id`
-   `booking_id` (nullable until booking creation)
-   `driver_id`
-   `trip_type`
-   `route_distance_meters`
-   `estimated_duration_seconds`
-   `pricing_breakdown` (JSON snapshot)
-   `currency`
-   `total_amount_minor`
-   `pricing_rule_version`
-   `expires_at`
-   `created_at`

Store all money in integer minor units. Avoid floating-point arithmetic.

## 8. Suggested API

-   `POST /api/v1/quotes`
-   `GET /api/v1/quotes/:quoteId`
-   `POST /api/v1/quotes/:quoteId/refresh`

The backend must calculate the fare. Never accept a client-calculated
total as authoritative.

## 9. Acceptance criteria

-   One-way quote includes a separately visible return component.
-   Round-trip quote includes return and agreed waiting charges.
-   10% fee is itemised.
-   Expired quotes cannot be used to create a booking.
-   Changes to driver rates or pricing configuration do not rewrite old
    quote snapshots.

------------------------------------------------------------------------

# Feature 08 --- Booking Lifecycle

## 1. Objective

Manage the complete journey from consumer booking request to driver
acceptance, trip execution, completion, cancellation or dispute.

## 2. Booking statuses

  Status             Meaning
  ------------------ ----------------------------------------------------
  `draft`            Consumer is preparing a trip
  `requested`        Booking request sent to driver
  `accepted`         Driver accepted and slot reserved
  `declined`         Driver declined
  `expired`          Driver did not respond in time
  `driver_arrived`   Driver reports arrival at pickup
  `in_progress`      Trip started
  `completed`        Trip completed
  `cancelled`        Booking cancelled
  `no_show`          A party did not attend under the applicable policy
  `disputed`         A complaint or fare/safety dispute is open
  `closed`           Booking is administratively closed

## 3. Main flow

1.  Consumer creates a trip plan.
2.  Backend calculates route and quote.
3.  Consumer selects a driver and confirms request.
4.  Driver receives a booking offer.
5.  Driver accepts or declines within a configured response window.
6.  On acceptance, backend atomically reserves the driver time slot.
7.  Consumer and driver receive confirmation.
8.  Driver arrives at pickup.
9.  Consumer verifies driver/booking using a one-time trip PIN where
    enabled.
10. Driver starts the trip.
11. Driver completes the trip.
12. Fare is finalised according to the disclosed pricing policy.
13. Payment/payout workflow is completed.
14. Consumer and driver may submit reviews.

## 4. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  BOOK-001                Create booking from     P0
                          valid quote             

  BOOK-002                Notify selected driver  P0

  BOOK-003                Driver can accept or    P0
                          decline                 

  BOOK-004                Prevent double          P0
                          allocation of           
                          driver/time slot        

  BOOK-005                Display booking status  P0
                          and details             

  BOOK-006                Support cancellation    P0
                          with reason and policy  
                          calculation             

  BOOK-007                Support arrived,        P0
                          started and completed   
                          milestones              

  BOOK-008                Support trip PIN        P1
                          verification            

  BOOK-009                Record trip timestamps  P0
                          and actuals             

  BOOK-010                Support no-show         P1
                          workflow                

  BOOK-011                Support rescheduling    P1
                          with availability and   
                          quote revalidation      
  -----------------------------------------------------------------------

## 5. State transition rules

-   `draft` → `requested`
-   `requested` → `accepted`, `declined`, `expired` or `cancelled`
-   `accepted` → `driver_arrived` or `cancelled`
-   `driver_arrived` → `in_progress`, `cancelled` or `no_show`
-   `in_progress` → `completed` or `disputed`
-   `completed` → `closed` or `disputed`
-   `disputed` → `resolved`/`closed` or an authorised financial
    adjustment/refund workflow

Enforce transitions on the backend. Do not trust a status sent by the
browser.

## 6. Cancellation policy configuration

Define separate policies for: - Consumer cancellation before driver
acceptance - Consumer cancellation after acceptance - Driver
cancellation - Driver no-show - Consumer no-show - Cancellation after
trip start - Cancellation due to safety or emergency

The applicable fee/refund must be disclosed before confirmation and
stored with the booking policy version.

## 7. Suggested API endpoints

-   `POST /api/v1/bookings`
-   `GET /api/v1/bookings`
-   `GET /api/v1/bookings/:bookingId`
-   `POST /api/v1/bookings/:bookingId/accept`
-   `POST /api/v1/bookings/:bookingId/decline`
-   `POST /api/v1/bookings/:bookingId/cancel`
-   `POST /api/v1/bookings/:bookingId/arrived`
-   `POST /api/v1/bookings/:bookingId/start`
-   `POST /api/v1/bookings/:bookingId/complete`
-   `POST /api/v1/bookings/:bookingId/dispute`

## 8. Acceptance criteria

-   Only the assigned driver can accept the request.
-   Only valid state transitions are allowed.
-   Concurrent requests cannot reserve the same driver twice.
-   Every transition records actor, timestamp and relevant metadata.
-   Cancellation policy is applied consistently and auditable.

------------------------------------------------------------------------

# Feature 09 --- Payments, Refunds and Driver Payouts

## 1. Objective

Collect consumer payments, track platform revenue, calculate driver
earnings and manage refunds/payouts.

## 2. Release recommendation

For an early prototype, payment records may be simulated in a test
environment. For a public pilot, select a payment provider and obtain
legal/finance review of marketplace collection, settlement, refunds, tax
and driver payout obligations.

## 3. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  PAY-001                 Create payment record   P1
                          linked to booking and   
                          quote                   

  PAY-002                 Create payment          P1
                          intent/order on backend 

  PAY-003                 Verify signed payment   P1
                          webhooks and process    
                          idempotently            

  PAY-004                 Support full/partial    P1
                          refunds with reason and 
                          approval                

  PAY-005                 Calculate driver        P1
                          payable amount and      
                          platform fee in ledger  

  PAY-006                 Finance admin can       P1
                          review payout and       
                          settlement status       

  PAY-007                 Configure enabled       P1
                          payment methods         
  -----------------------------------------------------------------------

## 4. Payment statuses

-   `pending`
-   `requires_action`
-   `authorized`
-   `captured`
-   `failed`
-   `partially_refunded`
-   `refunded`
-   `cancelled`

## 5. Ledger principles

For each completed booking, record: - Consumer amount charged - Driver
service amount - Platform fee - Taxes (where applicable) - Pass-through
expenses - Refunds/adjustments - Driver net payable - Payout reference
and status

The sum of ledger entries must reconcile to the booking's financial
outcome. Do not calculate financial history from mutable profile rates.

## 6. Security and reliability

-   Do not store raw card details.
-   Keep provider secrets on the backend.
-   Verify webhook signatures.
-   Use idempotency keys for payment operations.
-   Handle duplicate webhook delivery safely.
-   Maintain reconciliation reports for provider settlements.

## 7. Suggested API endpoints

-   `POST /api/v1/payments/intents`
-   `GET /api/v1/payments/:paymentId`
-   `POST /api/v1/webhooks/payments`
-   `POST /api/v1/admin/payments/:paymentId/refund`
-   `GET /api/v1/drivers/me/earnings`
-   `GET /api/v1/admin/payouts`

## 8. Acceptance criteria

-   Payment amount matches the accepted quote/approved adjustment.
-   Duplicate webhook events do not create duplicate ledger entries.
-   Refunds require an authorised action and reason.
-   Driver earnings and platform fees can be reconciled per booking.

------------------------------------------------------------------------

# Feature 10 --- Notifications and Communication

## 1. Objective

Keep consumers and drivers informed about account verification, booking
actions, trip milestones and support updates.

## 2. Channels

-   In-app notifications
-   SMS/OTP
-   Email
-   Push notifications (later mobile app phase)

## 3. Functional requirements

  ------------------------------------------------------------------------
  ID                    Requirement                  Priority
  --------------------- ---------------------------- ---------------------
  NTF-001               Notify user about            P0
                        registration and             
                        verification                 

  NTF-002               Notify driver of new booking P0
                        request                      

  NTF-003               Notify consumer of driver    P0
                        acceptance/decline/timeout   

  NTF-004               Notify both parties of       P0
                        cancellation and trip        
                        milestones                   

  NTF-005               Provide support contact path P0
                        for active booking           

  NTF-006               Maintain in-app notification P1
                        history                      

  NTF-007               Support channel preferences  P2
  ------------------------------------------------------------------------

## 4. Event catalogue

-   `user.registered`
-   `user.contact_verified`
-   `driver.kyc_submitted`
-   `driver.kyc_approved`
-   `driver.kyc_rejected`
-   `booking.requested`
-   `booking.accepted`
-   `booking.declined`
-   `booking.expired`
-   `booking.cancelled`
-   `booking.driver_arrived`
-   `booking.started`
-   `booking.completed`
-   `payment.succeeded`
-   `payment.failed`
-   `refund.processed`
-   `support.case_updated`

## 5. Rules

-   Notifications must be generated from trusted backend events.
-   Do not include full KYC details, passwords, OTPs or sensitive
    personal data in notifications.
-   Use retries with bounded backoff for transient provider failures.
-   Avoid duplicate notifications for duplicate events.
-   Log delivery status and provider reference where available.

## 6. Suggested API endpoints

-   `GET /api/v1/notifications`
-   `PATCH /api/v1/notifications/:notificationId/read`
-   `PUT /api/v1/users/me/notification-preferences`

## 7. Acceptance criteria

-   Correct recipients receive the correct event.
-   Duplicate event processing does not send uncontrolled duplicates.
-   Users cannot read another user's notification history.

------------------------------------------------------------------------

# Feature 11 --- Safety, Trust, Incidents and Reviews

## 1. Objective

Build trust between consumers and professional drivers and provide a
clear process for safety incidents, complaints and service quality.

## 2. MVP safety foundations

-   Genuine driver identity and licence verification before public
    launch.
-   Clear driver profile and verification status.
-   Booking reference and trip PIN/OTP to verify the correct driver and
    trip.
-   Emergency contact capture where appropriate.
-   Support path for active trips.
-   Incident reporting and restricted staff access.
-   Auditable trip status history.

## 3. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  SAFE-001                Allow eligible trip     P1
                          participants to rate    
                          each other after        
                          completion              

  SAFE-002                Support structured      P1
                          feedback tags and       
                          comments                

  SAFE-003                Allow incident report   P0
                          against a booking       

  SAFE-004                Provide SOS entry point P1
                          in supported            
                          active-trip experience  

  SAFE-005                Support consent-based   P2
                          trip sharing when       
                          tracking is implemented 

  SAFE-006                Restrict access to      P1
                          emergency and incident  
                          records                 

  SAFE-007                Maintain moderation and P1
                          complaint resolution    
                          workflow                
  -----------------------------------------------------------------------

## 4. Incident categories

-   Driver conduct
-   Consumer conduct
-   Unsafe driving
-   Vehicle issue
-   Route or trip dispute
-   Harassment or threat
-   Accident or medical emergency
-   Lost property
-   Other

## 5. SOS behaviour

An SOS button must have a real, tested operational response behind it.
It should create an urgent incident, capture the booking reference and
available trip context, alert the configured support team and show the
user what action has been taken. Do not claim emergency services have
been contacted unless an actual integration or operational procedure
does so.

## 6. Reviews

-   Only booking participants can review each other.
-   Reviews are available only after eligible trip completion.
-   One review per reviewer per booking.
-   Users can report abusive or fraudulent reviews.
-   Admin moderation decisions must be recorded.

## 7. Acceptance criteria

-   An unauthorised user cannot view incident details.
-   SOS creates an urgent case and triggers the configured escalation.
-   A user cannot review a booking they did not participate in.
-   Safety incidents are not treated as ordinary cancellation tickets.

------------------------------------------------------------------------

# Feature 12 --- Admin Console and Operations

## 1. Objective

Provide internal teams with tools to operate the marketplace, review
drivers, monitor bookings, configure policies and resolve customer
issues.

## 2. Admin roles

  ---------------------------------------------------------------------
  Role                               Responsibilities
  ---------------------------------- ----------------------------------
  Super admin                        Global settings, role assignment
                                     and full platform oversight

  Operations admin                   Users, drivers, bookings and
                                     service-area operations

  KYC reviewer                       Driver document review and
                                     decisions

  Support agent                      Booking support and
                                     customer/driver cases

  Finance admin                      Payments, refunds, payouts and
                                     reconciliation
  ---------------------------------------------------------------------

Apply least privilege. A staff member should receive only the
permissions needed for their work.

## 3. Functional requirements

  ID        Requirement                                          Priority
  --------- ---------------------------------------------------- ----------
  ADM-001   Search/filter users, drivers and consumers           P0
  ADM-002   Review KYC and record decision/reason                P0
  ADM-003   Suspend/reactivate accounts and drivers              P0
  ADM-004   View booking details and event timeline              P0
  ADM-005   Configure pricing and cancellation rules             P0
  ADM-006   Manage supported states/cities                       P0
  ADM-007   Manage support cases and disputes                    P1
  ADM-008   Record every privileged admin action in audit logs   P0
  ADM-009   Export reports with permission controls              P1
  ADM-010   Manage staff roles and permissions                   P1

## 4. Dashboard modules

-   Overview: registrations, active drivers, pending KYC, bookings and
    alerts.
-   Driver management: profile, service areas, rates, availability and
    status.
-   KYC queue: document review, expiry, resubmission and decisions.
-   Booking management: booking status, route, quote snapshot and event
    timeline.
-   Pricing configuration: platform fee, minimum hours, buffers, waiting
    rates and one-way policy.
-   Service areas: enabled states and cities.
-   Support: open cases, priority, assignment and resolution.
-   Finance: payment, refund and payout views (finance role only).
-   Audit logs: privileged actions and configuration changes.

## 5. Business rules

-   Admin actions require authentication and permission checks.
-   Sensitive actions require a reason.
-   Pricing changes must be versioned and apply to new quotes.
-   Admins must not edit a completed booking's historical quote
    snapshot.
-   KYC decisions must record reviewer, time and reason.
-   Exported files must respect access controls and data minimisation.

## 6. Suggested API endpoints

-   `GET /api/v1/admin/dashboard`
-   `GET /api/v1/admin/users`
-   `GET /api/v1/admin/drivers`
-   `POST /api/v1/admin/drivers/:driverId/review`
-   `POST /api/v1/admin/users/:userId/status`
-   `GET /api/v1/admin/bookings`
-   `GET /api/v1/admin/bookings/:bookingId`
-   `GET/PUT /api/v1/admin/config/pricing`
-   `GET/PUT /api/v1/admin/service-areas`
-   `GET /api/v1/admin/audit-logs`

## 7. Acceptance criteria

-   Staff cannot access modules outside their role.
-   KYC and pricing actions are audited.
-   Suspended drivers are removed from search.
-   Existing booking quote snapshots remain unchanged after
    configuration updates.

------------------------------------------------------------------------

# Feature 13 --- Analytics and Reporting

## 1. Objective

Help product and operations teams measure marketplace growth, booking
fulfilment, driver performance, customer satisfaction and financial
outcomes.

## 2. Core metrics

  ---------------------------------------------------------------------
  Metric                             Definition
  ---------------------------------- ----------------------------------
  Driver activation                  Approved drivers who complete
                                     onboarding and become bookable

  Search-to-book conversion          Confirmed bookings divided by
                                     eligible searches

  Match rate                         Searches returning at least one
                                     eligible driver divided by total
                                     searches

  Time to match                      Time from search/request to driver
                                     acceptance

  Booking fulfilment                 Completed trips divided by
                                     confirmed bookings

  Cancellation rate                  Cancelled bookings divided by
                                     confirmed bookings, segmented by
                                     actor/stage

  Estimate accuracy                  Difference between quoted estimate
                                     and final fare

  Repeat booking rate                Consumers with another completed
                                     booking in a defined period

  Driver earnings                    Gross and net driver earnings and
                                     payout timeliness

  Platform revenue                   Platform fees collected, net of
                                     refunds and adjustments

  Safety response time               Time from incident report to first
                                     human response
  ---------------------------------------------------------------------

## 3. Functional requirements

  -----------------------------------------------------------------------
  ID                      Requirement             Priority
  ----------------------- ----------------------- -----------------------
  AN-001                  Report user             P1
                          registration and driver 
                          activation funnel       

  AN-002                  Report search,          P1
                          conversion, acceptance  
                          and fulfilment          

  AN-003                  Report cancellations by P1
                          actor, reason and stage 

  AN-004                  Report booking value,   P1
                          platform fees, refunds  
                          and payouts             

  AN-005                  Report ratings, support P2
                          cases and safety case   
                          volumes                 
  -----------------------------------------------------------------------

## 4. Filters

-   Date range
-   State/city/service area
-   Trip type
-   Booking status
-   Driver cohort
-   Acquisition source (if captured with consent)
-   Payment status

## 5. Rules

-   Define each metric once and use consistent event definitions.
-   Financial reports must reconcile with the ledger.
-   Avoid exposing KYC or incident details in general dashboards.
-   Exports must enforce admin permissions and data minimisation.

## 6. Acceptance criteria

-   Dashboard counts reconcile with underlying booking/user records.
-   Date and service-area filters work consistently.
-   Financial metrics reconcile to payment and payout ledger records.

------------------------------------------------------------------------

# Feature 14 --- Platform Architecture and Data Model

## 1. Objective

Define a maintainable technical foundation for the DriveThrough
marketplace using React, Express, Supabase and Google Maps.

## 2. Proposed architecture

``` text
React Web App
  ├── Consumer experience
  ├── Driver experience
  └── Admin experience
        |
        v
Express.js API
  ├── Authentication & authorization
  ├── Consumer profiles & vehicles
  ├── Driver onboarding & KYC
  ├── Preferences & availability
  ├── Maps & route estimation
  ├── Search & matching
  ├── Pricing & quotes
  ├── Booking lifecycle
  ├── Payments & ledger
  ├── Notifications
  ├── Safety & support
  └── Admin & analytics
        |
        +---- Supabase PostgreSQL
        +---- Supabase Storage (private KYC files)
        +---- Google Maps Platform
        +---- OTP / email / SMS provider
        +---- Payment provider (later phase)
        +---- Background worker / queue
```

Start with a modular monolith rather than microservices. Keep module
boundaries clear so that high-volume or independently operated
components can be separated later.

## 3. Core data entities

  ---------------------------------------------------------------------
  Table                              Purpose
  ---------------------------------- ----------------------------------
  `users`                            Authentication identity and
                                     account role/status

  `user_sessions`                    Refresh token/session metadata

  `consumer_profiles`                Consumer-specific profile data

  `driver_profiles`                  Driver-specific professional
                                     profile

  `driver_documents`                 KYC and licence document
                                     metadata/status

  `driver_service_areas`             Driver-selected states and
                                     optional cities

  `driver_preferences`               Trip and vehicle preferences

  `driver_rate_cards`                Hourly/minimum/waiting rates and
                                     versions

  `driver_availability`              Availability windows and blocked
                                     periods

  `vehicles`                         Consumer vehicle profiles

  `bookings`                         Trip request and booking state

  `booking_quotes`                   Immutable quote snapshots

  `booking_events`                   Booking lifecycle event history

  `payments`                         Payment provider state

  `financial_ledger_entries`         Platform fee, driver payable,
                                     refunds and adjustments

  `driver_payouts`                   Driver settlement records

  `reviews`                          Post-trip feedback

  `support_cases`                    Customer and safety support

  `notifications`                    Notification history

  `audit_logs`                       Privileged/admin action history
  ---------------------------------------------------------------------

## 4. Key engineering rules

-   Use UUID primary keys.
-   Use UTC timestamps.
-   Store money as integer minor units and currency code.
-   Store route distance in metres and duration in seconds.
-   Use database migrations for schema changes.
-   Use transactions for driver slot reservation, booking transitions
    and ledger posting.
-   Use idempotency keys for booking creation and payment operations.
-   Index booking status/schedule, driver availability, service areas
    and user ownership columns.
-   Keep KYC files in private storage.
-   Do not expose Supabase service-role credentials to the browser.

## 5. Supabase security

If the React client accesses Supabase directly, configure Row Level
Security on every exposed table and test policies. If the application
uses Express for all data access, enforce authorization in Express and
use a restricted server-side database role where possible. RLS can still
provide defence in depth.

## 6. Suggested backend modules

``` text
src/
  modules/
    auth/
    users/
    consumers/
    vehicles/
    drivers/
    driver-documents/
    service-areas/
    availability/
    maps/
    search/
    pricing/
    quotes/
    bookings/
    payments/
    ledger/
    notifications/
    reviews/
    support/
    admin/
    analytics/
  common/
    middleware/
    errors/
    validation/
    database/
    jobs/
    utils/
  app.ts
  server.ts
```

## 7. Observability

-   Structured logs with request/correlation IDs.
-   Error tracking for API and frontend failures.
-   Metrics for API latency, booking transitions, Maps errors and
    notification delivery.
-   Alerts for booking acceptance failures, payment mismatches and
    urgent safety cases.
-   Avoid logging passwords, OTPs, full KYC data, access tokens or
    payment secrets.

------------------------------------------------------------------------

# Feature 15 --- Non-functional Requirements and Release Readiness

## 1. Performance and availability

  ---------------------------------------------------------------------
  Area                               Initial target
  ---------------------------------- ----------------------------------
  API latency                        Typical internal API p95 under 500
                                     ms, excluding external provider
                                     latency

  Driver search                      Target under 3 seconds under
                                     expected pilot load

  Availability                       99.5% MVP target, excluding
                                     planned maintenance

  Frontend                           Responsive on modern mobile and
                                     desktop browsers

  Reliability                        Retry-safe, idempotent
                                     booking/payment operations
  ---------------------------------------------------------------------

Targets must be validated with realistic load tests and adjusted based
on the pilot.

## 2. Security

-   HTTPS for all production traffic.
-   Secure password hashing.
-   Short-lived access tokens and refresh-token rotation.
-   Server-side authorization for every protected operation.
-   Strict CORS and rate limits.
-   Input validation and output encoding.
-   Protection against IDOR, injection, XSS, CSRF, brute force and file
    upload abuse.
-   Restricted secrets management.
-   Signed webhook verification.
-   Audit logging for privileged operations.

## 3. Privacy

-   Collect only data needed to provide the service.
-   Explain why identity, licence, location and emergency contact data
    is collected.
-   Restrict access to KYC and incident information.
-   Define retention and deletion policies.
-   Obtain consent for location sharing and tracking.
-   Do not expose sensitive information in analytics, notifications or
    logs.

## 4. Reliability and data integrity

-   Use transactions for booking acceptance and driver slot reservation.
-   Enforce valid booking state transitions.
-   Use idempotency keys for retried requests.
-   Make payment webhook processing idempotent.
-   Maintain immutable quote and booking event history.
-   Back up the database and test restoration.
-   Monitor failed background jobs and provide safe retries.

## 5. QA test coverage

Test: - Registration, OTP, login and role permissions. - Driver
onboarding and KYC review. - Multiple state selection and interstate
matching. - Availability conflicts and double-booking prevention. -
Google Maps timeout and quota failure. - One-way and round-trip price
calculations. - Quote expiry and rate changes. - Driver accept/decline
and booking state transitions. - Cancellation/no-show rules. - Payment
webhook duplication and refund processing. - Data isolation between
consumers, drivers and admins. - File upload access control and signed
URL expiry.

## 6. Release phases

  -----------------------------------------------------------------------
  Phase                   Deliverables            Exit criteria
  ----------------------- ----------------------- -----------------------
  0 --- Discovery         Pilot city, pricing,    Decisions approved
                          compliance and safety   
                          policies                

  1 --- Foundation        Auth, profiles, driver  Test driver can be
                          onboarding, test KYC,   approved in staging
                          admin review            

  2 --- Booking MVP       Maps, pricing, matching One-way and round-trip
                          and booking lifecycle   flows pass end-to-end
                                                  tests

  3 --- Controlled pilot  Notifications, support, Pilot operations can
                          cancellations, reviews  support completed trips
                          and reports             

  4 --- Production        Real KYC,               All launch gates passed
  readiness               payments/payouts,       
                          security, privacy and   
                          legal review            

  5 --- Expansion         More cities/states,     Service quality and
                          live tracking and       operational capacity
                          mobile apps             support growth
  -----------------------------------------------------------------------

## 7. Production launch gates

Do not launch a public driver marketplace with dummy KYC. Before public
launch, complete: - Genuine identity and driving-credential
verification. - State-by-state legal and operational review. - Insurance
and liability review for drivers operating consumer-owned vehicles. -
Safety response and incident escalation process. - Privacy notice,
consent, data retention and deletion policies. - Payment, refund, tax
and payout policy. - Customer support coverage and cancellation/no-show
policies. - Security review, monitoring, backups and recovery testing.

## 8. Product decisions still open

1.  Is the 10% platform fee added to the consumer's fare or deducted
    from driver earnings?
2.  What exact formula calculates one-way return/deadhead compensation?
3.  For round trips, does the driver wait at the destination or return
    later?
4.  Are overnight, meals, accommodation and waiting charges applicable?
5.  Will MVP support instant booking, scheduled booking or both?
6.  What is the pilot city/state and route-state matching policy?
7.  What verification is mandatory for consumers, and at which point in
    the journey?
8.  Which KYC, payment, OTP and notification providers will be used?
9.  What are the cancellation, no-show and fare-adjustment rules?
10. What are the applicable insurance and liability arrangements?

## 9. Definition of done

A feature is complete when: - Its requirements and acceptance criteria
are met. - Server-side validation and authorization are implemented. -
Loading, empty, error and success UI states are handled. - Relevant
happy paths, edge cases and security cases are tested. - Database
migrations and indexes are reviewed. - Logs do not expose secrets or
sensitive personal data. - Product owner accepts the feature.

------------------------------------------------------------------------
