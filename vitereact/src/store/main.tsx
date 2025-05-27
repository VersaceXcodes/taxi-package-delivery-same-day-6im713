import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';

// Type Definitions
interface User {
  uid: string;
  email: string;
  user_type: 'sender' | 'courier';
  first_name: string;
  last_name: string;
  profile_image_url: string;
  is_verified: boolean;
  account_status: 'active' | 'pending' | 'suspended';
}

interface SessionManagement {
  jwt_token: string | null;
  refresh_token: string | null;
  token_expiry: string | null;
  session_id: string | null;
  last_activity: string | null;
}

interface AuthenticationStatus {
  is_authenticated: boolean;
  is_loading: boolean;
  login_attempts: number;
  session_valid: boolean;
}

interface RolePermissions {
  sender_permissions: string[];
  courier_permissions: string[];
  admin_permissions: string[];
}

interface AuthenticationState {
  current_user: User | null;
  session_management: SessionManagement;
  authentication_status: AuthenticationStatus;
  role_permissions: RolePermissions;
}

interface WebSocketConnection {
  connection_status: 'connected' | 'disconnected' | 'reconnecting';
  connection_id: string | null;
  last_heartbeat: string | null;
  reconnect_attempts: number;
}

interface OrderTrackingSubscription {
  order_id: string;
  subscription_type: string;
  subscribed_at: string;
}

interface NotificationSubscription {
  user_id: string | null;
  channels: string[];
}

interface MessagingSubscription {
  order_id: string;
  participants: string[];
}

interface SystemAlertSubscription {
  alert_types: string[];
}

interface ActiveSubscriptions {
  order_tracking: OrderTrackingSubscription[];
  notification_feed: NotificationSubscription;
  messaging_channels: MessagingSubscription[];
  system_alerts: SystemAlertSubscription;
}

interface LocationUpdate {
  order_id: string;
  courier_id: string;
  location: { latitude: number; longitude: number };
  timestamp: string;
}

interface StatusChange {
  order_id: string;
  previous_status: string;
  new_status: string;
  timestamp: string;
}

interface MessageNotification {
  message_id: string;
  order_id: string;
  sender_id: string;
  content: string;
  timestamp: string;
}

interface SystemAnnouncement {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

interface RealTimeData {
  location_updates: LocationUpdate[];
  status_changes: StatusChange[];
  message_notifications: MessageNotification[];
  system_announcements: SystemAnnouncement[];
}

interface QueuedMessage {
  id: string;
  type: string;
  payload: any;
  timestamp: string;
}

interface QueuedLocationUpdate {
  order_id: string;
  location: { latitude: number; longitude: number };
  timestamp: string;
}

interface OfflineQueue {
  queued_messages: QueuedMessage[];
  queued_location_updates: QueuedLocationUpdate[];
  sync_pending: boolean;
}

interface RealTimeCommunicationState {
  websocket_connection: WebSocketConnection;
  active_subscriptions: ActiveSubscriptions;
  real_time_data: RealTimeData;
  offline_queue: OfflineQueue;
}

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: string;
  is_read: boolean;
  order_id?: string;
  data?: any;
}

interface NotificationCenter {
  unread_count: number;
  notifications: Notification[];
  notification_types: string[];
  last_checked: string | null;
}

interface QuietHours {
  enabled: boolean;
  start_time: string;
  end_time: string;
  timezone: string;
}

interface NotificationPreferences {
  in_app_notifications: boolean;
  email_notifications: boolean;
  sms_notifications: boolean;
  push_notifications: boolean;
  quiet_hours: QuietHours;
}

interface DeviceToken {
  device_id: string;
  token: string;
  platform: string;
}

interface PushNotificationSetup {
  permission_granted: boolean;
  subscription_id: string | null;
  device_tokens: DeviceToken[];
}

interface NotificationSystemState {
  notification_center: NotificationCenter;
  notification_preferences: NotificationPreferences;
  push_notification_setup: PushNotificationSetup;
}

interface RetryConfig {
  max_retries: number;
  retry_delay: number;
  exponential_backoff: boolean;
}

interface ApiConfiguration {
  base_url: string;
  api_version: string;
  timeout_duration: number;
  retry_configuration: RetryConfig;
}

interface FeatureFlags {
  real_time_tracking: boolean;
  advanced_analytics: boolean;
  social_login: boolean;
  multi_language_support: boolean;
}

interface UserInterfaceSettings {
  theme_preference: 'light' | 'dark' | 'auto';
  language_setting: string;
  accessibility_mode: boolean;
  reduced_motion: boolean;
}

interface GeolocationSettings {
  location_permission: 'granted' | 'denied' | 'prompt';
  high_accuracy_mode: boolean;
  background_location: boolean;
}

interface ApplicationConfigurationState {
  api_configuration: ApiConfiguration;
  feature_flags: FeatureFlags;
  user_interface_settings: UserInterfaceSettings;
  geolocation_settings: GeolocationSettings;
}

interface ApplicationError {
  error_id: string;
  error_type: string;
  message: string;
  timestamp: string;
  context?: any;
}

interface ErrorHistory {
  error_id: string;
  error_type: string;
  message: string;
  timestamp: string;
  resolved: boolean;
}

interface ErrorTracking {
  current_errors: ApplicationError[];
  error_history: ErrorHistory[];
  error_reporting_enabled: boolean;
}

interface ServiceHealth {
  delivery_service: 'operational' | 'degraded' | 'down';
  payment_service: 'operational' | 'degraded' | 'down';
  notification_service: 'operational' | 'degraded' | 'down';
}

interface SystemStatus {
  api_connectivity: 'online' | 'offline' | 'degraded';
  websocket_status: 'connected' | 'disconnected' | 'reconnecting';
  service_health: ServiceHealth;
  maintenance_mode: boolean;
}

interface ComponentLoadingState {
  component_id: string;
  loading: boolean;
}

interface LoadingStates {
  global_loading: boolean;
  page_loading: boolean;
  component_loading: ComponentLoadingState[];
}

interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  message: string;
  timestamp: string;
  auto_hide?: boolean;
}

interface ModalAction {
  label: string;
  action: string;
}

interface ModalMessage {
  id: string;
  type: 'error' | 'warning' | 'info';
  title: string;
  message: string;
  actions: ModalAction[];
}

interface UserFeedback {
  toast_notifications: ToastNotification[];
  modal_messages: ModalMessage[];
}

interface ErrorHandlingState {
  error_tracking: ErrorTracking;
  system_status: SystemStatus;
  loading_states: LoadingStates;
  user_feedback: UserFeedback;
}

// Main Store State Interface
interface AppState {
  // State
  authentication_state: AuthenticationState;
  real_time_communication_state: RealTimeCommunicationState;
  notification_system_state: NotificationSystemState;
  application_configuration_state: ApplicationConfigurationState;
  error_handling_state: ErrorHandlingState;
  
  // WebSocket instance
  socket: Socket | null;
  
  // Authentication Actions
  set_current_user: (user: User | null) => void;
  set_session_tokens: (tokens: { jwt_token: string; refresh_token: string; token_expiry: string }) => void;
  set_authentication_loading: (loading: boolean) => void;
  clear_authentication_state: () => void;
  increment_login_attempts: () => void;
  reset_login_attempts: () => void;
  
  // WebSocket Actions
  connect_websocket: () => void;
  disconnect_websocket: () => void;
  subscribe_to_order_tracking: (order_id: string) => void;
  unsubscribe_from_order_tracking: (order_id: string) => void;
  subscribe_to_notifications: (channels: string[]) => void;
  subscribe_to_messaging: (order_id: string, participants: string[]) => void;
  add_location_update: (update: LocationUpdate) => void;
  add_status_change: (change: StatusChange) => void;
  add_message_notification: (message: MessageNotification) => void;
  add_system_announcement: (announcement: SystemAnnouncement) => void;
  queue_message: (message: QueuedMessage) => void;
  queue_location_update: (update: QueuedLocationUpdate) => void;
  sync_offline_queue: () => void;
  
  // Notification Actions
  add_notification: (notification: Notification) => void;
  mark_notification_read: (notification_id: string) => void;
  mark_all_notifications_read: () => void;
  update_notification_preferences: (preferences: Partial<NotificationPreferences>) => void;
  set_push_notification_setup: (setup: Partial<PushNotificationSetup>) => void;
  
  // Configuration Actions
  update_api_configuration: (config: Partial<ApiConfiguration>) => void;
  update_feature_flags: (flags: Partial<FeatureFlags>) => void;
  update_ui_settings: (settings: Partial<UserInterfaceSettings>) => void;
  update_geolocation_settings: (settings: Partial<GeolocationSettings>) => void;
  
  // Error Handling Actions
  add_error: (error: ApplicationError) => void;
  resolve_error: (error_id: string) => void;
  update_system_status: (status: Partial<SystemStatus>) => void;
  set_loading_state: (component_id: string, loading: boolean) => void;
  set_global_loading: (loading: boolean) => void;
  add_toast_notification: (notification: ToastNotification) => void;
  remove_toast_notification: (id: string) => void;
  add_modal_message: (message: ModalMessage) => void;
  remove_modal_message: (id: string) => void;
}

// Default State Values
const defaultAuthenticationState: AuthenticationState = {
  current_user: null,
  session_management: {
    jwt_token: null,
    refresh_token: null,
    token_expiry: null,
    session_id: null,
    last_activity: null,
  },
  authentication_status: {
    is_authenticated: false,
    is_loading: false,
    login_attempts: 0,
    session_valid: false,
  },
  role_permissions: {
    sender_permissions: [],
    courier_permissions: [],
    admin_permissions: [],
  },
};

const defaultRealTimeCommunicationState: RealTimeCommunicationState = {
  websocket_connection: {
    connection_status: 'disconnected',
    connection_id: null,
    last_heartbeat: null,
    reconnect_attempts: 0,
  },
  active_subscriptions: {
    order_tracking: [],
    notification_feed: {
      user_id: null,
      channels: [],
    },
    messaging_channels: [],
    system_alerts: {
      alert_types: [],
    },
  },
  real_time_data: {
    location_updates: [],
    status_changes: [],
    message_notifications: [],
    system_announcements: [],
  },
  offline_queue: {
    queued_messages: [],
    queued_location_updates: [],
    sync_pending: false,
  },
};

const defaultNotificationSystemState: NotificationSystemState = {
  notification_center: {
    unread_count: 0,
    notifications: [],
    notification_types: ['order_update', 'message', 'payment', 'system'],
    last_checked: null,
  },
  notification_preferences: {
    in_app_notifications: true,
    email_notifications: true,
    sms_notifications: true,
    push_notifications: false,
    quiet_hours: {
      enabled: false,
      start_time: '22:00',
      end_time: '07:00',
      timezone: 'America/New_York',
    },
  },
  push_notification_setup: {
    permission_granted: false,
    subscription_id: null,
    device_tokens: [],
  },
};

const defaultApplicationConfigurationState: ApplicationConfigurationState = {
  api_configuration: {
    base_url: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
    api_version: 'v1',
    timeout_duration: 30000,
    retry_configuration: {
      max_retries: 3,
      retry_delay: 1000,
      exponential_backoff: true,
    },
  },
  feature_flags: {
    real_time_tracking: true,
    advanced_analytics: true,
    social_login: true,
    multi_language_support: false,
  },
  user_interface_settings: {
    theme_preference: 'light',
    language_setting: 'en-US',
    accessibility_mode: false,
    reduced_motion: false,
  },
  geolocation_settings: {
    location_permission: 'prompt',
    high_accuracy_mode: true,
    background_location: false,
  },
};

const defaultErrorHandlingState: ErrorHandlingState = {
  error_tracking: {
    current_errors: [],
    error_history: [],
    error_reporting_enabled: true,
  },
  system_status: {
    api_connectivity: 'online',
    websocket_status: 'disconnected',
    service_health: {
      delivery_service: 'operational',
      payment_service: 'operational',
      notification_service: 'operational',
    },
    maintenance_mode: false,
  },
  loading_states: {
    global_loading: false,
    page_loading: false,
    component_loading: [],
  },
  user_feedback: {
    toast_notifications: [],
    modal_messages: [],
  },
};

// Create the Zustand store
export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      // Initial State
      authentication_state: defaultAuthenticationState,
      real_time_communication_state: defaultRealTimeCommunicationState,
      notification_system_state: defaultNotificationSystemState,
      application_configuration_state: defaultApplicationConfigurationState,
      error_handling_state: defaultErrorHandlingState,
      socket: null,

      // Authentication Actions
      set_current_user: (user: User | null) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            current_user: user,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_authenticated: user !== null,
              session_valid: user !== null,
            },
          },
        }));
      },

      set_session_tokens: (tokens: { jwt_token: string; refresh_token: string; token_expiry: string }) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            session_management: {
              ...state.authentication_state.session_management,
              jwt_token: tokens.jwt_token,
              refresh_token: tokens.refresh_token,
              token_expiry: tokens.token_expiry,
              last_activity: new Date().toISOString(),
            },
          },
        }));
      },

      set_authentication_loading: (loading: boolean) => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              is_loading: loading,
            },
          },
        }));
      },

      clear_authentication_state: () => {
        set((state) => ({
          authentication_state: defaultAuthenticationState,
          real_time_communication_state: {
            ...state.real_time_communication_state,
            active_subscriptions: {
              ...defaultRealTimeCommunicationState.active_subscriptions,
            },
          },
        }));
        get().disconnect_websocket();
      },

      increment_login_attempts: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              login_attempts: state.authentication_state.authentication_status.login_attempts + 1,
            },
          },
        }));
      },

      reset_login_attempts: () => {
        set((state) => ({
          authentication_state: {
            ...state.authentication_state,
            authentication_status: {
              ...state.authentication_state.authentication_status,
              login_attempts: 0,
            },
          },
        }));
      },

      // WebSocket Actions
      connect_websocket: () => {
        const state = get();
        const { jwt_token } = state.authentication_state.session_management;
        const { base_url } = state.application_configuration_state.api_configuration;
        
        if (state.socket) {
          state.socket.disconnect();
        }

        if (!jwt_token) {
          return;
        }

        const socket = io(base_url, {
          auth: {
            token: jwt_token,
          },
          transports: ['websocket'],
        });

        socket.on('connect', () => {
          set((state) => ({
            real_time_communication_state: {
              ...state.real_time_communication_state,
              websocket_connection: {
                ...state.real_time_communication_state.websocket_connection,
                connection_status: 'connected',
                connection_id: socket.id,
                last_heartbeat: new Date().toISOString(),
                reconnect_attempts: 0,
              },
            },
            error_handling_state: {
              ...state.error_handling_state,
              system_status: {
                ...state.error_handling_state.system_status,
                websocket_status: 'connected',
              },
            },
          }));
        });

        socket.on('disconnect', () => {
          set((state) => ({
            real_time_communication_state: {
              ...state.real_time_communication_state,
              websocket_connection: {
                ...state.real_time_communication_state.websocket_connection,
                connection_status: 'disconnected',
                connection_id: null,
              },
            },
            error_handling_state: {
              ...state.error_handling_state,
              system_status: {
                ...state.error_handling_state.system_status,
                websocket_status: 'disconnected',
              },
            },
          }));
        });

        socket.on('reconnect_attempt', () => {
          set((state) => ({
            real_time_communication_state: {
              ...state.real_time_communication_state,
              websocket_connection: {
                ...state.real_time_communication_state.websocket_connection,
                connection_status: 'reconnecting',
                reconnect_attempts: state.real_time_communication_state.websocket_connection.reconnect_attempts + 1,
              },
            },
            error_handling_state: {
              ...state.error_handling_state,
              system_status: {
                ...state.error_handling_state.system_status,
                websocket_status: 'reconnecting',
              },
            },
          }));
        });

        // Real-time event handlers
        socket.on('location_update', (data: LocationUpdate) => {
          get().add_location_update(data);
        });

        socket.on('order_status_change', (data: StatusChange) => {
          get().add_status_change(data);
        });

        socket.on('message_received', (data: MessageNotification) => {
          get().add_message_notification(data);
        });

        socket.on('courier_assignment', (data: any) => {
          get().add_notification({
            id: `courier_assignment_${Date.now()}`,
            type: 'courier_assignment',
            title: 'New Delivery Assignment',
            message: 'You have a new delivery assignment',
            timestamp: new Date().toISOString(),
            is_read: false,
            data,
          });
        });

        socket.on('notification_push', (data: Notification) => {
          get().add_notification(data);
        });

        socket.on('eta_update', (data: any) => {
          get().add_notification({
            id: `eta_update_${Date.now()}`,
            type: 'eta_update',
            title: 'Delivery Time Updated',
            message: 'Your delivery ETA has been updated',
            timestamp: new Date().toISOString(),
            is_read: false,
            order_id: data.order_id,
            data,
          });
        });

        socket.on('system_alert', (data: SystemAnnouncement) => {
          get().add_system_announcement(data);
        });

        set({ socket });
      },

      disconnect_websocket: () => {
        const state = get();
        if (state.socket) {
          state.socket.disconnect();
          set({ socket: null });
        }
      },

      subscribe_to_order_tracking: (order_id: string) => {
        const state = get();
        const subscription: OrderTrackingSubscription = {
          order_id,
          subscription_type: 'location_updates',
          subscribed_at: new Date().toISOString(),
        };

        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            active_subscriptions: {
              ...state.real_time_communication_state.active_subscriptions,
              order_tracking: [
                ...state.real_time_communication_state.active_subscriptions.order_tracking,
                subscription,
              ],
            },
          },
        }));

        if (state.socket) {
          state.socket.emit('subscribe_order_tracking', { order_id });
        }
      },

      unsubscribe_from_order_tracking: (order_id: string) => {
        const state = get();
        
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            active_subscriptions: {
              ...state.real_time_communication_state.active_subscriptions,
              order_tracking: state.real_time_communication_state.active_subscriptions.order_tracking.filter(
                (sub) => sub.order_id !== order_id
              ),
            },
          },
        }));

        if (state.socket) {
          state.socket.emit('unsubscribe_order_tracking', { order_id });
        }
      },

      subscribe_to_notifications: (channels: string[]) => {
        const state = get();
        const user_id = state.authentication_state.current_user?.uid || null;

        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            active_subscriptions: {
              ...state.real_time_communication_state.active_subscriptions,
              notification_feed: {
                user_id,
                channels,
              },
            },
          },
        }));

        if (state.socket) {
          state.socket.emit('subscribe_notifications', { channels });
        }
      },

      subscribe_to_messaging: (order_id: string, participants: string[]) => {
        const state = get();
        const subscription: MessagingSubscription = {
          order_id,
          participants,
        };

        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            active_subscriptions: {
              ...state.real_time_communication_state.active_subscriptions,
              messaging_channels: [
                ...state.real_time_communication_state.active_subscriptions.messaging_channels,
                subscription,
              ],
            },
          },
        }));

        if (state.socket) {
          state.socket.emit('subscribe_messaging', { order_id, participants });
        }
      },

      add_location_update: (update: LocationUpdate) => {
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            real_time_data: {
              ...state.real_time_communication_state.real_time_data,
              location_updates: [
                ...state.real_time_communication_state.real_time_data.location_updates.filter(
                  (existing) => existing.order_id !== update.order_id
                ),
                update,
              ],
            },
          },
        }));
      },

      add_status_change: (change: StatusChange) => {
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            real_time_data: {
              ...state.real_time_communication_state.real_time_data,
              status_changes: [
                ...state.real_time_communication_state.real_time_data.status_changes,
                change,
              ],
            },
          },
        }));

        // Also add as notification
        get().add_notification({
          id: `status_change_${Date.now()}`,
          type: 'order_update',
          title: 'Order Status Updated',
          message: `Your order status changed to ${change.new_status}`,
          timestamp: change.timestamp,
          is_read: false,
          order_id: change.order_id,
        });
      },

      add_message_notification: (message: MessageNotification) => {
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            real_time_data: {
              ...state.real_time_communication_state.real_time_data,
              message_notifications: [
                ...state.real_time_communication_state.real_time_data.message_notifications,
                message,
              ],
            },
          },
        }));

        // Also add as notification
        get().add_notification({
          id: `message_${message.message_id}`,
          type: 'message',
          title: 'New Message',
          message: message.content,
          timestamp: message.timestamp,
          is_read: false,
          order_id: message.order_id,
        });
      },

      add_system_announcement: (announcement: SystemAnnouncement) => {
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            real_time_data: {
              ...state.real_time_communication_state.real_time_data,
              system_announcements: [
                ...state.real_time_communication_state.real_time_data.system_announcements,
                announcement,
              ],
            },
          },
        }));

        // Also add as notification
        get().add_notification({
          id: `system_${announcement.id}`,
          type: 'system',
          title: 'System Alert',
          message: announcement.message,
          timestamp: announcement.timestamp,
          is_read: false,
          data: announcement,
        });
      },

      queue_message: (message: QueuedMessage) => {
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            offline_queue: {
              ...state.real_time_communication_state.offline_queue,
              queued_messages: [
                ...state.real_time_communication_state.offline_queue.queued_messages,
                message,
              ],
              sync_pending: true,
            },
          },
        }));
      },

      queue_location_update: (update: QueuedLocationUpdate) => {
        set((state) => ({
          real_time_communication_state: {
            ...state.real_time_communication_state,
            offline_queue: {
              ...state.real_time_communication_state.offline_queue,
              queued_location_updates: [
                ...state.real_time_communication_state.offline_queue.queued_location_updates,
                update,
              ],
              sync_pending: true,
            },
          },
        }));
      },

      sync_offline_queue: async () => {
        const state = get();
        const { queued_messages, queued_location_updates } = state.real_time_communication_state.offline_queue;

        if (state.socket && state.socket.connected) {
          // Sync queued messages
          for (const message of queued_messages) {
            state.socket.emit(message.type, message.payload);
          }

          // Sync queued location updates
          for (const update of queued_location_updates) {
            state.socket.emit('location_update', update);
          }

          // Clear queue
          set((state) => ({
            real_time_communication_state: {
              ...state.real_time_communication_state,
              offline_queue: {
                queued_messages: [],
                queued_location_updates: [],
                sync_pending: false,
              },
            },
          }));
        }
      },

      // Notification Actions
      add_notification: (notification: Notification) => {
        set((state) => ({
          notification_system_state: {
            ...state.notification_system_state,
            notification_center: {
              ...state.notification_system_state.notification_center,
              notifications: [
                notification,
                ...state.notification_system_state.notification_center.notifications,
              ],
              unread_count: state.notification_system_state.notification_center.unread_count + 1,
            },
          },
        }));
      },

      mark_notification_read: (notification_id: string) => {
        set((state) => ({
          notification_system_state: {
            ...state.notification_system_state,
            notification_center: {
              ...state.notification_system_state.notification_center,
              notifications: state.notification_system_state.notification_center.notifications.map((notif) =>
                notif.id === notification_id ? { ...notif, is_read: true } : notif
              ),
              unread_count: Math.max(0, state.notification_system_state.notification_center.unread_count - 1),
            },
          },
        }));
      },

      mark_all_notifications_read: () => {
        set((state) => ({
          notification_system_state: {
            ...state.notification_system_state,
            notification_center: {
              ...state.notification_system_state.notification_center,
              notifications: state.notification_system_state.notification_center.notifications.map((notif) => ({
                ...notif,
                is_read: true,
              })),
              unread_count: 0,
              last_checked: new Date().toISOString(),
            },
          },
        }));
      },

      update_notification_preferences: (preferences: Partial<NotificationPreferences>) => {
        set((state) => ({
          notification_system_state: {
            ...state.notification_system_state,
            notification_preferences: {
              ...state.notification_system_state.notification_preferences,
              ...preferences,
            },
          },
        }));
      },

      set_push_notification_setup: (setup: Partial<PushNotificationSetup>) => {
        set((state) => ({
          notification_system_state: {
            ...state.notification_system_state,
            push_notification_setup: {
              ...state.notification_system_state.push_notification_setup,
              ...setup,
            },
          },
        }));
      },

      // Configuration Actions
      update_api_configuration: (config: Partial<ApiConfiguration>) => {
        set((state) => ({
          application_configuration_state: {
            ...state.application_configuration_state,
            api_configuration: {
              ...state.application_configuration_state.api_configuration,
              ...config,
            },
          },
        }));
      },

      update_feature_flags: (flags: Partial<FeatureFlags>) => {
        set((state) => ({
          application_configuration_state: {
            ...state.application_configuration_state,
            feature_flags: {
              ...state.application_configuration_state.feature_flags,
              ...flags,
            },
          },
        }));
      },

      update_ui_settings: (settings: Partial<UserInterfaceSettings>) => {
        set((state) => ({
          application_configuration_state: {
            ...state.application_configuration_state,
            user_interface_settings: {
              ...state.application_configuration_state.user_interface_settings,
              ...settings,
            },
          },
        }));
      },

      update_geolocation_settings: (settings: Partial<GeolocationSettings>) => {
        set((state) => ({
          application_configuration_state: {
            ...state.application_configuration_state,
            geolocation_settings: {
              ...state.application_configuration_state.geolocation_settings,
              ...settings,
            },
          },
        }));
      },

      // Error Handling Actions
      add_error: (error: ApplicationError) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            error_tracking: {
              ...state.error_handling_state.error_tracking,
              current_errors: [
                ...state.error_handling_state.error_tracking.current_errors,
                error,
              ],
            },
          },
        }));
      },

      resolve_error: (error_id: string) => {
        set((state) => {
          const errorToResolve = state.error_handling_state.error_tracking.current_errors.find(
            (err) => err.error_id === error_id
          );
          
          return {
            error_handling_state: {
              ...state.error_handling_state,
              error_tracking: {
                ...state.error_handling_state.error_tracking,
                current_errors: state.error_handling_state.error_tracking.current_errors.filter(
                  (err) => err.error_id !== error_id
                ),
                error_history: errorToResolve
                  ? [
                      ...state.error_handling_state.error_tracking.error_history,
                      {
                        error_id: errorToResolve.error_id,
                        error_type: errorToResolve.error_type,
                        message: errorToResolve.message,
                        timestamp: errorToResolve.timestamp,
                        resolved: true,
                      },
                    ]
                  : state.error_handling_state.error_tracking.error_history,
              },
            },
          };
        });
      },

      update_system_status: (status: Partial<SystemStatus>) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            system_status: {
              ...state.error_handling_state.system_status,
              ...status,
            },
          },
        }));
      },

      set_loading_state: (component_id: string, loading: boolean) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            loading_states: {
              ...state.error_handling_state.loading_states,
              component_loading: [
                ...state.error_handling_state.loading_states.component_loading.filter(
                  (comp) => comp.component_id !== component_id
                ),
                { component_id, loading },
              ],
            },
          },
        }));
      },

      set_global_loading: (loading: boolean) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            loading_states: {
              ...state.error_handling_state.loading_states,
              global_loading: loading,
            },
          },
        }));
      },

      add_toast_notification: (notification: ToastNotification) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            user_feedback: {
              ...state.error_handling_state.user_feedback,
              toast_notifications: [
                ...state.error_handling_state.user_feedback.toast_notifications,
                notification,
              ],
            },
          },
        }));
      },

      remove_toast_notification: (id: string) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            user_feedback: {
              ...state.error_handling_state.user_feedback,
              toast_notifications: state.error_handling_state.user_feedback.toast_notifications.filter(
                (notif) => notif.id !== id
              ),
            },
          },
        }));
      },

      add_modal_message: (message: ModalMessage) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            user_feedback: {
              ...state.error_handling_state.user_feedback,
              modal_messages: [
                ...state.error_handling_state.user_feedback.modal_messages,
                message,
              ],
            },
          },
        }));
      },

      remove_modal_message: (id: string) => {
        set((state) => ({
          error_handling_state: {
            ...state.error_handling_state,
            user_feedback: {
              ...state.error_handling_state.user_feedback,
              modal_messages: state.error_handling_state.user_feedback.modal_messages.filter(
                (msg) => msg.id !== id
              ),
            },
          },
        }));
      },
    }),
    {
      name: 'quickcourier-store',
      partialize: (state) => ({
        authentication_state: state.authentication_state,
        notification_system_state: {
          ...state.notification_system_state,
          notification_center: {
            ...state.notification_system_state.notification_center,
            notifications: state.notification_system_state.notification_center.notifications.slice(0, 50), // Limit stored notifications
          },
        },
        application_configuration_state: state.application_configuration_state,
      }),
    }
  )
);

// Export types for components to use
export type {
  User,
  AuthenticationState,
  RealTimeCommunicationState,
  NotificationSystemState,
  ApplicationConfigurationState,
  ErrorHandlingState,
  Notification,
  LocationUpdate,
  StatusChange,
  MessageNotification,
  SystemAnnouncement,
  ToastNotification,
  ModalMessage,
  ApplicationError,
};