# Railway Ticket Reservation System

A RESTful API for managing railway ticket reservations with support for confirmed, RAC, and waiting list tickets.

## Features

- Book tickets with berth allocation
- Cancel tickets with automatic RAC and waiting list promotion
- View booked tickets with passenger details
- Check available tickets and berths
- Priority-based berth allocation
- RAC ticket sharing (2 passengers per side-lower berth)
- Concurrency handling with row-level locking

### Database Schema

```mermaid
    PASSENGERS {
        int id PK
        string name
        int age
        string gender
    }
    TICKETS {
        int id PK
        string pnr_number
        string status
        string ticket_type
        int passenger_id FK
        int berth_id FK
    }
    BERTHS {
        int id PK
        string berth_number
        string berth_type
        string status
    }
```

## Setup

### Prerequisites

- Docker
- Docker Compose
- Node.js 18+ (for local development)

### Installation

1. Clone the repository:

```bash
git clone <repository-url>
cd railway-ticket-system
```

2. Start the application using Docker Compose:

```bash
docker-compose up -d
```

The application will be available at `http://localhost:3000`

### Environment Variables

- `NODE_ENV`: Environment (production/development)
- `DB_HOST`: Database host
- `DB_USER`: Database user
- `DB_PASSWORD`: Database password
- `DB_NAME`: Database name

## API Documentation

### Book a Ticket

```http
POST /api/v1/tickets/book
Content-Type: application/json

{
  "name": "John Doe",
  "age": 30,
  "gender": "M",
  "isMotherWithChildren": false,
  "children": [] // Optional, for mother with children booking
}
```

Response:

```json
{
  "pnr": "ABC123",
  "status": "CONFIRMED",
  "berth": {
    "number": "1A",
    "type": "LOWER"
  },
  "passenger": {
    "name": "John Doe",
    "age": 30,
    "gender": "M",
    "type": "ADULT"
  }
}
```

### Cancel a Ticket

```http
POST /api/v1/tickets/cancel/{ticketId}
```

Response:

```json
{
  "message": "Ticket cancelled successfully"
}
```

### Get Booked Tickets

```http
GET /api/v1/tickets/booked
```

Response:

```json
[
  {
    "id": 1,
    "pnr_number": "ABC123",
    "status": "CONFIRMED",
    "ticket_type": "ADULT",
    "passenger_name": "John Doe",
    "passenger_age": 30,
    "passenger_gender": "M",
    "berth_number": "1A",
    "berth_type": "LOWER",
    "priority_category": "REGULAR"
  }
]
```

### Get Available Tickets

```http
GET /api/v1/tickets/available
```

Response:

```json
{
  "summary": {
    "confirmed_available": 57,
    "rac_available": 9,
    "rac_count": 0,
    "waiting_count": 0,
    "confirmed_count": 6,
    "remaining_confirmed": 57,
    "remaining_rac": 18,
    "remaining_waiting": 10,
    "rac_passengers_count": 0
  },
  "available_berths": [
    {
      "berth_number": "1A",
      "berth_type": "LOWER",
      "status": "AVAILABLE",
      "current_rac_passengers": 0
    }
  ]
}
```

## Business Rules

1. **Berth Allocation**:

   - 63 confirmed berths total
   - 9 RAC berths (18 RAC tickets, 2 passengers per side-lower berth)
   - 10 waiting-list tickets maximum

2. **Priority Rules**:

   - Passengers aged 60+ get priority for lower berths
   - Ladies with children get priority for lower berths
   - Children under 5 don't get berths but are recorded

3. **Cancellation Rules**:

   - When a confirmed ticket is cancelled:
     1. Next RAC ticket becomes confirmed
     2. Next waiting-list ticket moves to RAC

4. **RAC Rules**:
   - Side-lower berths are used for RAC tickets
   - Each side-lower berth can accommodate 2 RAC passengers
   - RAC tickets are allocated in order of booking

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- 400: Bad Request (invalid input)
- 404: Not Found (ticket not found)
- 409: Conflict (no tickets available)
- 500: Internal Server Error

## Concurrency Handling

The system uses row-level locking to prevent:

- Double booking of berths
- Race conditions during ticket booking
- Inconsistent state during cancellations
