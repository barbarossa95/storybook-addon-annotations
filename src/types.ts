export type AnnotationAuthor = 'human' | 'agent';
export type ThreadStatus = 'open' | 'resolved';

export interface FractionPoint {
  xFraction: number;
  yFraction: number;
}

export interface FractionRect {
  xFraction: number;
  yFraction: number;
  widthFraction: number;
  heightFraction: number;
}

export interface PointAnnotationAnchor {
  kind: 'point';
  storyId: string;
  elementKey: string;
  point: FractionPoint;
  rect: FractionRect;
}

export interface TextRangeAnnotationAnchor {
  kind: 'text-range';
  storyId: string;
  elementKey: string;
  point: FractionPoint;
  rect: FractionRect;
  quote: string;
  startOffset: number;
  endOffset: number;
  rangeRects: FractionRect[];
}

export type AnnotationAnchor = PointAnnotationAnchor | TextRangeAnnotationAnchor;
export type AnnotationGesturePayload = AnnotationAnchor;
export type AnnotationDraftPayload = AnnotationAnchor;

export interface AnnotationMessage {
  id: string;
  author: AnnotationAuthor;
  authorName?: string;
  body: string;
  createdAt: string;
}

export interface AnnotationThread {
  id: string;
  anchor: AnnotationAnchor;
  storyTitle?: string;
  status: ThreadStatus;
  messages: AnnotationMessage[];
  createdAt: string;
  updatedAt: string;
}

export type NewMessage = { author: AnnotationAuthor; authorName?: string; body: string };

export interface AnnotationCreateRequest {
  anchor: AnnotationAnchor;
  storyTitle?: string;
  message: NewMessage;
}

export interface AnnotationReplyRequest {
  id: string;
  message: NewMessage;
}

export interface AnnotationStatusRequest {
  id: string;
  status: ThreadStatus;
}

export interface AnnotationAnchorRequest {
  id: string;
  anchor: AnnotationAnchor;
}

export interface AnnotationsParameters {
  disable?: boolean;
  currentUser?: string;
}

export interface AnnotationsAddonState {
  onboardingDismissed: boolean;
  notificationDismissed: boolean;
  /** True once the setup dialog has been completed at least once. */
  setupDone: boolean;
  /** Display name for messages authored from the panel; chosen during setup. */
  reviewerName: string;
}

export interface AnnotationsPresetOptions {
  storeFile?: string;
  onboarding?: boolean;
  defaultAuthor?: string;
}
