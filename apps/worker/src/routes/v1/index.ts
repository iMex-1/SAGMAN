import { Hono } from 'hono';
import type { Env } from '../../bindings';
import type { AppBindings } from '../../types';
import { health } from './health';
import { auth } from './auth';
import { settings } from './settings';
import { cars } from './cars';
import { employees } from './employees';
import { appointments } from './appointments';
import { repairs } from './repairs';
import { parts } from './parts';
import { payments } from './payments';
import { portal } from './portal';
import { dashboard } from './dashboard';
import { reports } from './reports';
import { notifications } from './notifications';
import { calendar } from './calendar';
import { search } from './search';

const v1 = new Hono<AppBindings>();

v1.route('/health', health);
v1.route('/auth', auth);
v1.route('/settings', settings);
v1.route('/cars', cars);
v1.route('/employees', employees);
v1.route('/appointments', appointments);
v1.route('/repairs', repairs);
v1.route('/parts', parts);
v1.route('/payments', payments);
v1.route('/portal', portal);
v1.route('/dashboard', dashboard);
v1.route('/reports', reports);
v1.route('/notifications', notifications);
v1.route('/calendar', calendar);
v1.route('/search', search);

export { v1 };
