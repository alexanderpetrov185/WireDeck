/**
 * Контракт издателя (publisher).
 * Позволяет менять платформу публикации, реализуя этот интерфейс.
 */
export interface Publisher {
  /**
   * Публикация сообщения.
   * @param text Содержимое сообщения
   * @returns Идентификатор отправленного сообщения (telegramMessageId)
   * @throws Error если публикация завершилась неудачей
   */
  publish(text: string): Promise<string>;
}
