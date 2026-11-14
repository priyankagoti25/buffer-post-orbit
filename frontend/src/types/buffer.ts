export type Bucket =
  | "queue"
  | "scheduled"
  | "draft"
  | "overdue"
  | "approval"
  | "sent"
  | "failed"
  | "other";
export type Counts = Record<Bucket, number>;

export type Channel = {
  id: string;
  name: string;
  displayName?: string | null;
  service: string;
  avatar?: string | null;
  isQueuePaused?: boolean | null;
  isLocked?: boolean | null;
  isDisconnected?: boolean | null;
  timezone?: string | null;
  externalLink?: string | null;
  serviceId?: string | null;
  type?: string | null;
  createdAt?: string | null;
  organizationId: string;
  counts: Counts;
};

export type Organization = {
  id: string;
  name: string;
  ownerEmail?: string | null;
  channelCount: number;
  shouldEnforce2FASetup?: boolean | null;
  members?: { totalCount: number } | null;
  limits?: Record<string, number | null> | null;
  counts: Counts;
  pendingTruncated: boolean;
  channels: Channel[];
};

export type RateWindow = {
  window: string;
  limit: number | null;
  remaining: number;
  resetsInSeconds: number;
};
export type RateSnapshot = { capturedAt: string; windows: RateWindow[] };

export type AccountInfo = {
  id: string;
  email: string;
  backupEmail?: string | null;
  avatar?: string | null;
  createdAt?: string | null;
  timezone?: string | null;
  name?: string | null;
  preferences?: Record<string, unknown> | null;
};

export type UpcomingPost = {
  id: string;
  text: string;
  dueAt: string | null;
  status: string;
  bucket: Bucket;
  channelId: string;
};

export type Overview = {
  account: AccountInfo;
  organizations: Organization[];
  upcoming: UpcomingPost[];
  warnings: string[];
  sentCountIsPartial: boolean;
  generatedAt: string;
  rateLimit: RateSnapshot | null;
  cached?: boolean;
};

export type BufferStatus = {
  connected: boolean;
  reauthRequired: boolean;
  canRefresh?: boolean;
  scope: string | null;
  connectedAt: string | null;
};

export type PostAsset = {
  id?: string | null;
  mimeType?: string | null;
  source?: string | null;
  thumbnail?: string | null;
};

export type Post = {
  id: string;
  text: string;
  createdAt: string;
  dueAt: string | null;
  sentAt: string | null;
  status: string;
  channelId: string;
  channelService: string;
  shareMode: string | null;
  schedulingType: string | null;
  isCustomScheduled: boolean;
  externalLink: string | null;
  assets: PostAsset[];
  bucket: Bucket;
  repostCount?: number;
  /** True when one of the recurring posts created this post. */
  recurring?: boolean;
  lastRepostedAt?: string | null;
};

export type PostsPage = {
  posts: Post[];
  pageInfo: { hasNextPage: boolean; endCursor: string | null };
  note?: string;
};

export type CreateResult = {
  channelId: string;
  ok: boolean;
  post?: Partial<Post>;
  error?: string;
};

export type Asset = { kind: "image" | "video"; url: string; altText?: string };

export type TargetOptions = {
  instagramType?: "post" | "reel" | "story";
  shareToFeed?: boolean;
  facebookType?: "post" | "reel" | "story";
  title?: string;
  categoryId?: string;
  privacy?: "public" | "unlisted" | "private";
  madeForKids?: boolean;
  boardServiceId?: string;
  pinUrl?: string;
  schedulingType?: "automatic" | "notification";
};

export type Target = {
  channelId: string;
  service: string;
  options: TargetOptions;
};

export type RecurringRule = {
  frequency: "daily" | "weekly" | "monthly";
  interval: number;
  weekdays: number[];
  time: string;
  timezone: string;
};

export type RecurringSeries = {
  id: string;
  name: string;
  text: string;
  assets: Asset[];
  targets: Target[];
  rule: RecurringRule;
  startDate: string;
  endDate: string | null;
  maxOccurrences: number | null;
  status: "active" | "paused" | "completed" | "cancelled";
  upcoming: {
    index: number;
    dueAt: string;
    state: string;
    posts: { channelId: string; postId: string | null; error: string | null }[];
  }[];
  nextDueAt: string | null;
  publishedCount: number;
  failures: number;
  lastError: string | null;
  skippedDuplicates?: { dueAt: string; message: string }[];
  createdAt: string;
};

export type Idea = {
  id: string;
  /** 'app' = written here (may also be in Buffer). 'buffer' = only exists in Buffer. */
  source: "app" | "buffer";
  title: string;
  text: string;
  contentJson: Record<string, unknown> | null;
  assets: Asset[];
  organizationId: string | null;
  bufferIdeaId: string | null;
  syncStatus: "local" | "synced" | "failed";
  syncError: string | null;
  createdAt: string;
  updatedAt: string;
};
