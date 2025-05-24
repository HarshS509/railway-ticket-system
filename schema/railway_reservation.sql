-- Create database if not exists
CREATE DATABASE IF NOT EXISTS railway_reservation;
USE railway_reservation;

-- Passengers table
CREATE TABLE IF NOT EXISTS passengers (
    id INT PRIMARY KEY AUTO_INCREMENT,
    name VARCHAR(100) NOT NULL,
    age INT NOT NULL,
    gender ENUM('M', 'F', 'O') NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP())
);

-- Berths table
CREATE TABLE IF NOT EXISTS berths (
    id INT PRIMARY KEY AUTO_INCREMENT,
    berth_number VARCHAR(10) NOT NULL UNIQUE,
    berth_type ENUM('LOWER', 'MIDDLE', 'UPPER', 'SIDE_LOWER') NOT NULL,
    status ENUM('AVAILABLE', 'CONFIRMED', 'RAC', 'WAITING') NOT NULL DEFAULT 'AVAILABLE',
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP())
);

-- Tickets table
CREATE TABLE IF NOT EXISTS tickets (
    id INT PRIMARY KEY AUTO_INCREMENT,
    pnr_number VARCHAR(10) NOT NULL UNIQUE,
    status ENUM('CONFIRMED', 'RAC', 'WAITING', 'CANCELLED') NOT NULL,
    passenger_id INT NOT NULL,
    berth_id INT,
    ticket_type ENUM('ADULT', 'CHILD') NOT NULL,
    created_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    updated_at BIGINT NOT NULL DEFAULT (UNIX_TIMESTAMP()),
    FOREIGN KEY (passenger_id) REFERENCES passengers(id),
    FOREIGN KEY (berth_id) REFERENCES berths(id)
);

-- Create indexes
CREATE INDEX idx_tickets_pnr ON tickets(pnr_number);
CREATE INDEX idx_berths_status ON berths(status);
CREATE INDEX idx_tickets_status ON tickets(status);

-- Create triggers for automatic updated_at updates
CREATE TRIGGER passengers_update_timestamp
BEFORE UPDATE ON passengers
FOR EACH ROW
SET NEW.updated_at = UNIX_TIMESTAMP();

CREATE TRIGGER berths_update_timestamp
BEFORE UPDATE ON berths
FOR EACH ROW
SET NEW.updated_at = UNIX_TIMESTAMP();

CREATE TRIGGER tickets_update_timestamp
BEFORE UPDATE ON tickets
FOR EACH ROW
SET NEW.updated_at = UNIX_TIMESTAMP();

-- Insert initial berths data
INSERT INTO berths (berth_number, berth_type, status) VALUES
-- Lower berths (21 berths)
('L1', 'LOWER', 'AVAILABLE'), ('L2', 'LOWER', 'AVAILABLE'), ('L3', 'LOWER', 'AVAILABLE'),
('L4', 'LOWER', 'AVAILABLE'), ('L5', 'LOWER', 'AVAILABLE'), ('L6', 'LOWER', 'AVAILABLE'),
('L7', 'LOWER', 'AVAILABLE'), ('L8', 'LOWER', 'AVAILABLE'), ('L9', 'LOWER', 'AVAILABLE'),
('L10', 'LOWER', 'AVAILABLE'), ('L11', 'LOWER', 'AVAILABLE'), ('L12', 'LOWER', 'AVAILABLE'),
('L13', 'LOWER', 'AVAILABLE'), ('L14', 'LOWER', 'AVAILABLE'), ('L15', 'LOWER', 'AVAILABLE'),
('L16', 'LOWER', 'AVAILABLE'), ('L17', 'LOWER', 'AVAILABLE'), ('L18', 'LOWER', 'AVAILABLE'),
('L19', 'LOWER', 'AVAILABLE'), ('L20', 'LOWER', 'AVAILABLE'), ('L21', 'LOWER', 'AVAILABLE'),

-- Middle berths (21 berths)
('M1', 'MIDDLE', 'AVAILABLE'), ('M2', 'MIDDLE', 'AVAILABLE'), ('M3', 'MIDDLE', 'AVAILABLE'),
('M4', 'MIDDLE', 'AVAILABLE'), ('M5', 'MIDDLE', 'AVAILABLE'), ('M6', 'MIDDLE', 'AVAILABLE'),
('M7', 'MIDDLE', 'AVAILABLE'), ('M8', 'MIDDLE', 'AVAILABLE'), ('M9', 'MIDDLE', 'AVAILABLE'),
('M10', 'MIDDLE', 'AVAILABLE'), ('M11', 'MIDDLE', 'AVAILABLE'), ('M12', 'MIDDLE', 'AVAILABLE'),
('M13', 'MIDDLE', 'AVAILABLE'), ('M14', 'MIDDLE', 'AVAILABLE'), ('M15', 'MIDDLE', 'AVAILABLE'),
('M16', 'MIDDLE', 'AVAILABLE'), ('M17', 'MIDDLE', 'AVAILABLE'), ('M18', 'MIDDLE', 'AVAILABLE'),
('M19', 'MIDDLE', 'AVAILABLE'), ('M20', 'MIDDLE', 'AVAILABLE'), ('M21', 'MIDDLE', 'AVAILABLE'),

-- Upper berths (21 berths)
('U1', 'UPPER', 'AVAILABLE'), ('U2', 'UPPER', 'AVAILABLE'), ('U3', 'UPPER', 'AVAILABLE'),
('U4', 'UPPER', 'AVAILABLE'), ('U5', 'UPPER', 'AVAILABLE'), ('U6', 'UPPER', 'AVAILABLE'),
('U7', 'UPPER', 'AVAILABLE'), ('U8', 'UPPER', 'AVAILABLE'), ('U9', 'UPPER', 'AVAILABLE'),
('U10', 'UPPER', 'AVAILABLE'), ('U11', 'UPPER', 'AVAILABLE'), ('U12', 'UPPER', 'AVAILABLE'),
('U13', 'UPPER', 'AVAILABLE'), ('U14', 'UPPER', 'AVAILABLE'), ('U15', 'UPPER', 'AVAILABLE'),
('U16', 'UPPER', 'AVAILABLE'), ('U17', 'UPPER', 'AVAILABLE'), ('U18', 'UPPER', 'AVAILABLE'),
('U19', 'UPPER', 'AVAILABLE'), ('U20', 'UPPER', 'AVAILABLE'), ('U21', 'UPPER', 'AVAILABLE'),

-- Side lower berths (9 berths for RAC)
('SL1', 'SIDE_LOWER', 'AVAILABLE'), ('SL2', 'SIDE_LOWER', 'AVAILABLE'), ('SL3', 'SIDE_LOWER', 'AVAILABLE'),
('SL4', 'SIDE_LOWER', 'AVAILABLE'), ('SL5', 'SIDE_LOWER', 'AVAILABLE'), ('SL6', 'SIDE_LOWER', 'AVAILABLE'),
('SL7', 'SIDE_LOWER', 'AVAILABLE'), ('SL8', 'SIDE_LOWER', 'AVAILABLE'), ('SL9', 'SIDE_LOWER', 'AVAILABLE'); 