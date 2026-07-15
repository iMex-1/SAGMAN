-- System Settings
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('garage_name', 'Garage Sagman');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('garage_address', '');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('garage_phone', '');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('garage_logo_url', '');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('max_concurrent_cars', '5');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('working_hours', 'Mon-Sat 08:00-18:00');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('overseer_whatsapp_number', '');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('require_diagnosis_approval', 'true');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('require_client_approval', 'true');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('currency_label', 'DH');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('session_timeout_hours', '8');

-- Default Manager (password: Admin@2024)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, status)
VALUES ('00000000-0000-0000-0000-000000000001', 'Admin Manager', 'admin@sagman.garage', '$2a$12$903O0j1dPFEDwi8wexVFY.DeMrMnnbrn4.kxAMgYHASfU6Nv64aWS', 'manager', 'active');

-- Default Mechanic (password: Mechanic@2024)
INSERT OR IGNORE INTO users (id, name, email, password_hash, role, specialty, status)
VALUES ('00000000-0000-0000-0000-000000000002', 'Ahmed Mechanic', 'ahmed@sagman.garage', '$2a$12$cV4P5xmIOQbMpprYeSaD9OY8oAK5Hi/Mv67qb6.6fXvM6FOvg4tw6', 'mechanic', 'Engine, Suspension', 'active');

-- WhatsApp & Dépannage numbers
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('whatsapp_number', '+212694722954');
INSERT OR IGNORE INTO system_settings (key, value) VALUES ('depannage_number', '+212694722954');

-- Invoice Counter
INSERT OR IGNORE INTO invoice_counters (year, last_seq) VALUES ('2026', 0);
