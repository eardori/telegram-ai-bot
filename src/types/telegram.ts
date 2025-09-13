// Telegram Bot API Types

export interface TelegramUser {
  id: number;
  is_bot: boolean;
  first_name: string;
  last_name?: string;
  username?: string;
  language_code?: string;
}

export interface TelegramChat {
  id: number;
  type: 'private' | 'group' | 'supergroup' | 'channel';
  title?: string;
  username?: string;
  first_name?: string;
  last_name?: string;
  description?: string;
  invite_link?: string;
  pinned_message?: TelegramMessage;
}

export interface TelegramMessage {
  message_id: number;
  from?: TelegramUser;
  sender_chat?: TelegramChat;
  date: number;
  chat: TelegramChat;
  forward_from?: TelegramUser;
  forward_from_chat?: TelegramChat;
  forward_from_message_id?: number;
  forward_signature?: string;
  forward_sender_name?: string;
  forward_date?: number;
  is_automatic_forward?: boolean;
  reply_to_message?: TelegramMessage;
  via_bot?: TelegramUser;
  edit_date?: number;
  has_protected_content?: boolean;
  media_group_id?: string;
  author_signature?: string;
  text?: string;
  entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
  audio?: TelegramAudio;
  document?: TelegramDocument;
  photo?: TelegramPhotoSize[];
  sticker?: TelegramSticker;
  video?: TelegramVideo;
  video_note?: TelegramVideoNote;
  voice?: TelegramVoice;
  caption?: string;
  caption_entities?: TelegramMessageEntity[];
  contact?: TelegramContact;
  dice?: TelegramDice;
  game?: TelegramGame;
  poll?: TelegramPoll;
  venue?: TelegramVenue;
  location?: TelegramLocation;
  new_chat_members?: TelegramUser[];
  left_chat_member?: TelegramUser;
  new_chat_title?: string;
  new_chat_photo?: TelegramPhotoSize[];
  delete_chat_photo?: boolean;
  group_chat_created?: boolean;
  supergroup_chat_created?: boolean;
  channel_chat_created?: boolean;
  message_auto_delete_timer_changed?: TelegramMessageAutoDeleteTimerChanged;
  migrate_to_chat_id?: number;
  migrate_from_chat_id?: number;
  pinned_message?: TelegramMessage;
  invoice?: TelegramInvoice;
  successful_payment?: TelegramSuccessfulPayment;
  connected_website?: string;
  passport_data?: TelegramPassportData;
  proximity_alert_triggered?: TelegramProximityAlertTriggered;
  video_chat_scheduled?: TelegramVideoChatScheduled;
  video_chat_started?: TelegramVideoChatStarted;
  video_chat_ended?: TelegramVideoChatEnded;
  video_chat_participants_invited?: TelegramVideoChatParticipantsInvited;
  web_app_data?: TelegramWebAppData;
  reply_markup?: TelegramInlineKeyboardMarkup;
}

export interface TelegramMessageEntity {
  type: string;
  offset: number;
  length: number;
  url?: string;
  user?: TelegramUser;
  language?: string;
}

export interface TelegramUpdate {
  update_id: number;
  message?: TelegramMessage;
  edited_message?: TelegramMessage;
  channel_post?: TelegramMessage;
  edited_channel_post?: TelegramMessage;
  inline_query?: any;
  chosen_inline_result?: any;
  callback_query?: TelegramCallbackQuery;
  shipping_query?: any;
  pre_checkout_query?: any;
  poll?: TelegramPoll;
  poll_answer?: any;
  my_chat_member?: any;
  chat_member?: any;
  chat_join_request?: any;
}

export interface TelegramCallbackQuery {
  id: string;
  from: TelegramUser;
  message?: TelegramMessage;
  inline_message_id?: string;
  chat_instance: string;
  data?: string;
  game_short_name?: string;
}

export interface TelegramInlineKeyboardMarkup {
  inline_keyboard: TelegramInlineKeyboardButton[][];
}

export interface TelegramInlineKeyboardButton {
  text: string;
  url?: string;
  callback_data?: string;
  web_app?: TelegramWebApp;
  login_url?: TelegramLoginUrl;
  switch_inline_query?: string;
  switch_inline_query_current_chat?: string;
  callback_game?: any;
  pay?: boolean;
}

export interface TelegramWebApp {
  url: string;
}

export interface TelegramLoginUrl {
  url: string;
  forward_text?: string;
  bot_username?: string;
  request_write_access?: boolean;
}

// Additional interfaces for multimedia content
export interface TelegramPhotoSize {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  file_size?: number;
}

export interface TelegramAnimation {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramAudio {
  file_id: string;
  file_unique_id: string;
  duration: number;
  performer?: string;
  title?: string;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
  thumb?: TelegramPhotoSize;
}

export interface TelegramDocument {
  file_id: string;
  file_unique_id: string;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideo {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_name?: string;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramVideoNote {
  file_id: string;
  file_unique_id: string;
  length: number;
  duration: number;
  thumb?: TelegramPhotoSize;
  file_size?: number;
}

export interface TelegramVoice {
  file_id: string;
  file_unique_id: string;
  duration: number;
  mime_type?: string;
  file_size?: number;
}

export interface TelegramContact {
  phone_number: string;
  first_name: string;
  last_name?: string;
  user_id?: number;
  vcard?: string;
}

export interface TelegramDice {
  emoji: string;
  value: number;
}

export interface TelegramPoll {
  id: string;
  question: string;
  options: TelegramPollOption[];
  total_voter_count: number;
  is_closed: boolean;
  is_anonymous: boolean;
  type: string;
  allows_multiple_answers: boolean;
  correct_option_id?: number;
  explanation?: string;
  explanation_entities?: TelegramMessageEntity[];
  open_period?: number;
  close_date?: number;
}

export interface TelegramPollOption {
  text: string;
  voter_count: number;
}

export interface TelegramLocation {
  longitude: number;
  latitude: number;
  horizontal_accuracy?: number;
  live_period?: number;
  heading?: number;
  proximity_alert_radius?: number;
}

export interface TelegramVenue {
  location: TelegramLocation;
  title: string;
  address: string;
  foursquare_id?: string;
  foursquare_type?: string;
  google_place_id?: string;
  google_place_type?: string;
}

// Additional types for various features
export interface TelegramSticker {
  file_id: string;
  file_unique_id: string;
  width: number;
  height: number;
  is_animated: boolean;
  is_video: boolean;
  thumb?: TelegramPhotoSize;
  emoji?: string;
  set_name?: string;
  premium_animation?: TelegramFile;
  mask_position?: TelegramMaskPosition;
  custom_emoji_id?: string;
  file_size?: number;
}

export interface TelegramFile {
  file_id: string;
  file_unique_id: string;
  file_size?: number;
  file_path?: string;
}

export interface TelegramMaskPosition {
  point: string;
  x_shift: number;
  y_shift: number;
  scale: number;
}

export interface TelegramGame {
  title: string;
  description: string;
  photo: TelegramPhotoSize[];
  text?: string;
  text_entities?: TelegramMessageEntity[];
  animation?: TelegramAnimation;
}

export interface TelegramMessageAutoDeleteTimerChanged {
  message_auto_delete_time: number;
}

export interface TelegramInvoice {
  title: string;
  description: string;
  start_parameter: string;
  currency: string;
  total_amount: number;
}

export interface TelegramSuccessfulPayment {
  currency: string;
  total_amount: number;
  invoice_payload: string;
  shipping_option_id?: string;
  order_info?: TelegramOrderInfo;
  telegram_payment_charge_id: string;
  provider_payment_charge_id: string;
}

export interface TelegramOrderInfo {
  name?: string;
  phone_number?: string;
  email?: string;
  shipping_address?: TelegramShippingAddress;
}

export interface TelegramShippingAddress {
  country_code: string;
  state: string;
  city: string;
  street_line1: string;
  street_line2: string;
  post_code: string;
}

export interface TelegramPassportData {
  data: TelegramEncryptedPassportElement[];
  credentials: TelegramEncryptedCredentials;
}

export interface TelegramEncryptedPassportElement {
  type: string;
  data?: string;
  phone_number?: string;
  email?: string;
  files?: TelegramPassportFile[];
  front_side?: TelegramPassportFile;
  reverse_side?: TelegramPassportFile;
  selfie?: TelegramPassportFile;
  translation?: TelegramPassportFile[];
  hash: string;
}

export interface TelegramPassportFile {
  file_id: string;
  file_unique_id: string;
  file_size: number;
  file_date: number;
}

export interface TelegramEncryptedCredentials {
  data: string;
  hash: string;
  secret: string;
}

export interface TelegramProximityAlertTriggered {
  traveler: TelegramUser;
  watcher: TelegramUser;
  distance: number;
}

export interface TelegramVideoChatScheduled {
  start_date: number;
}

export interface TelegramVideoChatStarted {}

export interface TelegramVideoChatEnded {
  duration: number;
}

export interface TelegramVideoChatParticipantsInvited {
  users: TelegramUser[];
}

export interface TelegramWebAppData {
  data: string;
  button_text: string;
}

// Bot API Response Types
export interface TelegramApiResponse<T = any> {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
  parameters?: {
    migrate_to_chat_id?: number;
    retry_after?: number;
  };
}

export interface TelegramBotCommand {
  command: string;
  description: string;
}

export interface TelegramBotInfo {
  id: number;
  is_bot: boolean;
  first_name: string;
  username: string;
  can_join_groups: boolean;
  can_read_all_group_messages: boolean;
  supports_inline_queries: boolean;
}