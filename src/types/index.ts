export interface Provider {
  id: string;
  name: string;
  baseUrl: string;
  iframeTemplate: string;
  enabled: boolean;
  healthCheckUrl: string;
  rateLimit: {
    requests: number;
    windowMs: number;
  };
  proxyRequired: boolean;
}

export interface ProviderEmbedUrl {
  provider: string;
  embedUrl: string;
  iframeCode: string;
  success: boolean;
  error?: string;
}

export interface ProviderHealthStatus {
  provider: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  error?: string;
}

export interface ProxyConfig {
  url: string;
  enabled: boolean;
  lastUsed: Date;
  requestCount: number;
  successRate: number;
  healthCheckUrl?: string;
}

export interface ProxyHealthStatus {
  proxyUrl: string;
  status: 'healthy' | 'unhealthy' | 'unknown';
  lastChecked: Date;
  responseTime?: number;
  error?: string;
  successRate: number;
}

export interface WatchTogetherRoom {
  id: string;
  name: string;
  adminId: string;
  mediaId: string;
  mediaType: 'movie' | 'tv';
  providerId?: string;
  participants: string[];
  currentState: PlaybackState;
  isPublic: boolean;
  shareableLink: string | null;
  maxParticipants: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  playbackRate: number;
  currentEpisode?: number;
  providerUrl?: string;
}

export interface PlaybackAction {
  type: 'play' | 'pause' | 'seek' | 'setPlaybackRate' | 'updateTime' | 'changeEpisode' | 'changeProvider' | 'changeMedia';
  data: any;
}

export interface RoomEvent {
  type: 'create_room' | 'join_room' | 'leave_room' | 'playback_action' | 'update_time';
  data: any;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface SortParams {
  field: string;
  direction: 'asc' | 'desc';
}