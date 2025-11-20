// =================================================================
// TYPES FOR PROVIDERS BACKEND
// =================================================================

export interface Room {
  id: string;
  name: string;
  description?: string;
  hostId: string;
  adminId?: string;
  participants: string[];
  maxParticipants?: number;
  currentVideo?: {
    id: string;
    title: string;
    provider: string;
    timestamp: number;
  };
  currentState?: {
    playbackState: {
      isPlaying: boolean;
      currentTime: number;
      volume: number;
    };
    timestamp: number;
  };
  settings: {
    autoPlay: boolean;
    allowChat: boolean;
    maxParticipants: number;
  };
  shareableLink?: string;
  mediaId?: string;
  providerId?: string;
  mediaType?: 'movie' | 'tv';
  isPublic?: boolean;
  createdAt: Date;
  updatedAt: Date;
  expiresAt: Date;
}

export interface RoomParticipant {
  userId: string;
  roomId: string;
  joinedAt: Date;
  lastActivity: Date;
  isHost: boolean;
  isOnline: boolean;
  deviceInfo?: {
    userAgent: string;
    platform: string;
  };
}

export interface RoomState {
  roomId: string;
  currentVideo: {
    id: string;
    title: string;
    provider: string;
    timestamp: number;
    duration: number;
  };
  playbackState: {
    isPlaying: boolean;
    currentTime: number;
    volume: number;
  };
  currentTime?: number; // Add missing property
  lastUpdate: Date;
}

// Add missing interface types
export interface WatchTogetherRoom extends Room {
  hostId: string;
  participants: string[];
  isPublic: boolean;
  currentVideo?: {
    id: string;
    title: string;
    provider: string;
    timestamp: number;
  };
  settings: {
    autoPlay: boolean;
    allowChat: boolean;
    maxParticipants: number;
  };
  expiresAt: Date;
}

export interface RoomEvent {
  type: 'join' | 'leave' | 'play' | 'pause' | 'sync' | 'chat';
  userId: string;
  roomId: string;
  data?: any;
  timestamp: Date;
}

// Add system metrics type
export interface SystemMetrics {
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  uptime: number;
  timestamp: Date;
}

// Add type declaration for loadavg
declare global {
  namespace NodeJS {
    interface Process {
      loadavg?: number[];
    }
  }
}

export interface PlaybackAction {
  action: 'play' | 'pause' | 'seek' | 'volume_change' | 'skip';
  userId: string;
  timestamp: number;
  data?: any;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  responseTime: number;
  lastCheck: Date;
  error?: any;
  metadata?: Record<string, any>;
}

export interface SystemHealth {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  memory: {
    used: number;
    total: number;
    percentage: number;
  };
  cpu: {
    usage: number;
    loadAverage: number[];
  };
  checks: HealthCheck[];
  timestamp: Date;
}

export interface PerformanceMetrics {
  responseTime: number;
  memoryUsage: NodeJS.MemoryUsage;
  cpuUsage: NodeJS.CpuUsage;
  timestamp: number;
  endpoint: string;
  method: string;
  statusCode: number;
  provider?: string; // Optional
  roomId?: string; // Optional
}

export interface NotificationPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  data?: Record<string, any>;
  actions?: Array<{
    action: string;
    title: string;
    icon?: string;
  }>;
}

export interface PushNotificationOptions {
  priority?: 'high' | 'normal';
  ttl?: number;
  topic?: string;
  collapseKey?: string;
  data?: Record<string, any>;
}

export interface BulkNotificationResult {
  success: boolean;
  totalSent: number;
  totalFailed: number;
  results: Array<{
    token: string;
    success: boolean;
    error?: string;
  }>;
}

// Fix notification result types
export interface NotificationResult {
  success: boolean;
  token?: string;
  error?: string;
}

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // For cache invalidation
  compress?: boolean; // Whether to compress the data
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  limit: number;
}

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
  };
  meta?: {
    timestamp: string;
    requestId?: string;
    version?: string;
  };
}

export interface PaginatedResponse<T> extends ApiResponse<T[]> {
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
    hasNext: boolean;
    hasPrevious: boolean;
  };
}

export interface ProviderHealth {
  name: string;
  status: 'online' | 'offline' | 'degraded';
  responseTime: number;
  lastCheck: Date;
  errorCount: number;
  successCount: number;
  metadata?: Record<string, any>;
}

export interface WebSocketEvent {
  type: 'room_joined' | 'room_left' | 'video_played' | 'video_paused' | 'user_typing' | 'chat_message';
  roomId: string;
  userId: string;
  data: any;
  timestamp: number;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  type: 'text' | 'system' | 'action';
}

export interface UserSession {
  userId: string;
  roomId?: string;
  connectedAt: Date;
  lastActivity: Date;
  deviceInfo: {
    userAgent: string;
    platform: string;
    browser?: string;
    version?: string;
  };
  isActive: boolean;
}

export interface ProxyConfig {
  url: string;
  isActive: boolean;
  lastUsed: Date;
  successRate: number;
  responseTime: number;
  errorCount: number;
}