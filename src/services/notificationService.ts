import { sendPushNotification, sendPushNotificationToUsers, isOneSignalReady } from '../config/onesignal';
import { logger } from '../utils/logger';

export interface NotificationData {
  roomId: string;
  roomName?: string;
  inviterName?: string;
  shareableLink?: string;
  action?: string;
  timestamp?: string;
}

/**
 * Notification service for watch-together features
 */
export class NotificationService {
  /**
   * Send notification when user joins a room
   */
  async notifyUserJoinedRoom(
    roomId: string,
    userId: string,
    userName: string,
    participantIds: string[]
  ): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
      // Notify all participants except the new user
      const recipients = participantIds.filter(id => id !== userId);

      if (recipients.length === 0) return;

      const success = await sendPushNotificationToUsers(
        recipients,
        'User Joined Room',
        `${userName} joined the watch-together room`,
        {
          type: 'user_joined',
          roomId,
          userId,
          userName,
          timestamp: new Date().toISOString()
        }
      );

      if (success) {
        logger.info('Sent user joined notification', { roomId, userId, recipients: recipients.length });
      }
    } catch (error) {
      logger.error('Failed to send user joined notification:', error);
    }
  }

  /**
   * Send notification when user leaves a room
   */
  async notifyUserLeftRoom(
    roomId: string,
    userId: string,
    userName: string,
    participantIds: string[]
  ): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
      if (participantIds.length === 0) return;

      const success = await sendPushNotificationToUsers(
        participantIds,
        'User Left Room',
        `${userName} left the watch-together room`,
        {
          type: 'user_left',
          roomId,
          userId,
          userName,
          timestamp: new Date().toISOString()
        }
      );

      if (success) {
        logger.info('Sent user left notification', { roomId, userId, recipients: participantIds.length });
      }
    } catch (error) {
      logger.error('Failed to send user left notification:', error);
    }
  }

  /**
   * Send room invitation to a specific user
   */
  async sendRoomInvitation(
    targetUserId: string,
    inviterName: string,
    roomData: NotificationData
  ): Promise<boolean> {
    if (!isOneSignalReady()) return false;

    try {
      const success = await sendPushNotification(
        targetUserId,
        'Watch Together Invitation',
        `${inviterName} invited you to join "${roomData.roomName}"`,
        {
          type: 'room_invitation',
          ...roomData,
          timestamp: new Date().toISOString()
        }
      );

      if (success) {
        logger.info('Sent room invitation', { targetUserId, roomId: roomData.roomId });
      }

      return success;
    } catch (error) {
      logger.error('Failed to send room invitation:', error);
      return false;
    }
  }

  /**
   * Send notification when admin performs an action
   */
  async notifyAdminAction(
    roomId: string,
    adminName: string,
    action: string,
    participantIds: string[]
  ): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
      let title: string;
      let message: string;

      switch (action) {
        case 'pause':
          title = 'Playback Paused';
          message = `${adminName} paused the video`;
          break;
        case 'play':
          title = 'Playback Started';
          message = `${adminName} started the video`;
          break;
        case 'skip':
          title = 'Video Skipped';
          message = `${adminName} skipped in the video`;
          break;
        case 'end_session':
          title = 'Session Ended';
          message = `${adminName} ended the watch-together session`;
          break;
        default:
          title = 'Room Update';
          message = `${adminName} performed an action: ${action}`;
      }

      const success = await sendPushNotificationToUsers(
        participantIds,
        title,
        message,
        {
          type: 'admin_action',
          roomId,
          adminName,
          action,
          timestamp: new Date().toISOString()
        }
      );

      if (success) {
        logger.info('Sent admin action notification', { roomId, action, recipients: participantIds.length });
      }
    } catch (error) {
      logger.error('Failed to send admin action notification:', error);
    }
  }

  /**
   * Send notification when room settings change
   */
  async notifyRoomSettingsChanged(
    roomId: string,
    adminName: string,
    changes: Record<string, any>,
    participantIds: string[]
  ): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
      const success = await sendPushNotificationToUsers(
        participantIds,
        'Room Settings Updated',
        `${adminName} updated room settings`,
        {
          type: 'room_settings_changed',
          roomId,
          adminName,
          changes,
          timestamp: new Date().toISOString()
        }
      );

      if (success) {
        logger.info('Sent room settings notification', { roomId, changes: Object.keys(changes) });
      }
    } catch (error) {
      logger.error('Failed to send room settings notification:', error);
    }
  }

  /**
   * Send notification when media changes
   */
  async notifyMediaChanged(
    roomId: string,
    adminName: string,
    mediaTitle: string,
    participantIds: string[]
  ): Promise<void> {
    if (!isOneSignalReady()) return;

    try {
      const success = await sendPushNotificationToUsers(
        participantIds,
        'Media Changed',
        `${adminName} changed the video to "${mediaTitle}"`,
        {
          type: 'media_changed',
          roomId,
          adminName,
          mediaTitle,
          timestamp: new Date().toISOString()
        }
      );

      if (success) {
        logger.info('Sent media changed notification', { roomId, mediaTitle });
      }
    } catch (error) {
      logger.error('Failed to send media changed notification:', error);
    }
  }

  /**
   * Check if notifications are available
   */
  isNotificationsEnabled(): boolean {
    return isOneSignalReady();
  }
}

export const notificationService = new NotificationService();