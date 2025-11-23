# Booking Module

## Overview

The Booking module manages appointment bookings and reservations for the queue management system. It handles the complete booking lifecycle from creation to processing into attention records.

## Architecture

```
┌──────────────┐
│   Controller │
│  (HTTP API)  │
└──────┬───────┘
       │
       ▼
┌──────────────┐
│   Service    │
│ (Business    │
│   Logic)     │
└──────┬───────┘
       │
       ├──► QueueService
       ├──► CommerceService
       ├──► NotificationService
       ├──► ClientService
       ├──► AttentionService
       ├──► WaitlistService
       └──► BookingRepository (FireORM)
```

## Key Components

### BookingService

Main service containing booking business logic.

**Key Methods:**
- `createBooking()` - Create a new booking
- `confirmBooking()` - Confirm a pending booking
- `cancelBooking()` - Cancel a booking
- `processBookings()` - Process bookings for a date
- `transferBookingToQueue()` - Transfer booking to another queue
- `getBookingDetails()` - Get detailed booking information

### BookingController

HTTP endpoints for booking operations.

**Endpoints:**
- `POST /booking` - Create booking
- `GET /booking/:id` - Get booking by ID
- `GET /booking/queue/:queueId/date/:date` - Get bookings by queue and date
- `GET /booking/details/:id` - Get booking details
- `PATCH /booking/confirm/:id` - Confirm booking
- `PATCH /booking/cancel/:id` - Cancel booking
- `PATCH /booking/transfer/:id` - Transfer booking
- `PATCH /booking/edit/:id` - Edit booking date/block

### Booking Entity

```typescript
class Booking {
  id: string;
  number: number;
  date: string;
  dateFormatted: Date;
  queueId: string;
  commerceId: string;
  userId: string;
  clientId: string;
  status: BookingStatus;
  type: BookingType;
  channel: BookingChannel;
  block: Block;
  user: User;
  servicesId: string[];
  servicesDetails: object[];
  // ... more fields
}
```

## Booking Lifecycle

```
┌─────────────┐
│   PENDING   │ ← Created
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  CONFIRMED  │ ← Confirmed by admin
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  PROCESSED  │ ← Processed into attention
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  CANCELLED  │ ← Can be cancelled at any time
└─────────────┘
```

## Key Flows

### Create Booking Flow

```
1. Validate user terms acceptance
2. Validate booking blocks availability
3. Check queue limit
4. Generate booking number
5. Create/update client if needed
6. Create user if needed
7. Create booking entity
8. Send notifications (email/WhatsApp)
9. Return booking
```

### Confirm Booking Flow

```
1. Validate booking exists
2. Check feature toggle for confirmation
3. Update booking status to CONFIRMED
4. Handle package creation if needed
5. Process payment if configured
6. Create income record if payment processed
7. Create attention if booking is for today
8. Send confirmation notifications
9. Return updated booking
```

### Process Booking Flow

```
1. Get confirmed bookings for date
2. For each booking:
   a. Create attention record
   b. Update booking status to PROCESSED
   c. Link attention to booking
3. Return processing summary
```

## DTOs

### BookingDetailsDto

Response DTO for booking details endpoint.

```typescript
class BookingDetailsDto {
  id: string;
  number: number;
  date: string;
  status: BookingStatus;
  user: User;
  queue: Queue;
  commerce: Commerce;
  beforeYou: number; // Number of bookings before this one
  // ... more fields
}
```

### BookingAvailabilityDto

Response DTO for availability queries.

```typescript
class BookingAvailabilityDto {
  id: string;
  commerceId: string;
  queueId: string;
  number: number;
  date: string;
  status: BookingStatus;
  user: User;
  block: Block;
}
```

## Integration Points

### Queue Module
- Validates queue limits
- Gets queue configuration
- Checks block availability

### Commerce Module
- Gets commerce information
- Validates commerce settings
- Gets locale information for notifications

### Notification Module
- Sends booking confirmation emails
- Sends booking WhatsApp messages
- Sends cancellation notifications

### Client Module
- Creates/updates client records
- Links bookings to clients

### Attention Module
- Creates attention records from bookings
- Links bookings to attention

### Waitlist Module
- Creates bookings from waitlist entries
- Notifies waitlist when bookings are cancelled

## Error Handling

Common errors:
- `400 Bad Request`: Invalid input data
- `404 Not Found`: Booking/queue/commerce not found
- `409 Conflict`: Block already booked, limit reached
- `500 Internal Server Error`: Unexpected errors

## Feature Toggles

The module respects feature toggles for:
- Email notifications (`email-booking`)
- WhatsApp notifications (`whatsapp-booking`)
- Booking confirmation (`booking-confirm`)
- Payment processing (`booking-confirm-payment`)

## Testing

See `booking.service.spec.ts` for unit tests.

**Test Coverage:**
- Booking creation
- Booking confirmation
- Booking cancellation
- Block validation
- Queue limit validation
- Notification sending

## Examples

### Create Booking

```typescript
const booking = await bookingService.createBooking(
  queueId,
  BookingChannel.QR,
  '2024-01-15',
  user,
  { number: 1, hourFrom: 9, hourTo: 10 },
  BookingStatus.PENDING,
  ['service-id-1'],
  [{ tag: 'Service Name' }],
  'client-id',
  'session-id'
);
```

### Confirm Booking

```typescript
const confirmationData = {
  paid: true,
  paymentAmount: 100,
  paymentMethod: PaymentMethod.CASH,
  processPaymentNow: true,
  // ... more fields
};

const confirmed = await bookingService.confirmBooking(
  userId,
  bookingId,
  confirmationData
);
```

