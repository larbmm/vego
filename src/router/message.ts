export interface GroupMessage {
  sender: string;
  content: string;
  timestamp: Date;
  mentionsMe?: boolean;
  isReplyToMe?: boolean;
}

export interface GroupContext {
  recentMessages: GroupMessage[];
  members: string[];
}

export interface UnifiedMessage {
  platform: 'telegram' | 'discord' | 'feishu';
  user_id: string;
  platform_message_id: string;
  content: string;
  timestamp: Date;
  groupContext?: GroupContext;
}

export type MessageHandler = (message: UnifiedMessage) => Promise<string>;

export class MessageRouter {
  private handlers: Map<string, MessageHandler> = new Map();

  registerHandler(pattern: string, handler: MessageHandler): void {
    this.handlers.set(pattern, handler);
  }

  async route(message: UnifiedMessage): Promise<string> {
    const handler = this.handlers.get('all');
    if (!handler) {
      throw new Error('No handler registered for message routing');
    }
    return handler(message);
  }
}
