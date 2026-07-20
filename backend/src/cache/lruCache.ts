export type CacheEntry<T> = {
  value: T;
  expiresAt: number;
};

export type LruNode<T> = {
  key: string;
  value: CacheEntry<T>;
  prev: LruNode<T> | null;
  next: LruNode<T> | null;
};

export class LruCache<T> {
  private capacity: number;
  private cache: Map<string, LruNode<T>> = new Map();
  private head: LruNode<T> | null = null;
  private tail: LruNode<T> | null = null;

  constructor(capacity: number) {
    this.capacity = capacity;
  }

  get(key: string): T | null {
    const node = this.cache.get(key);
    if (!node) return null;

    if (Date.now() > node.value.expiresAt) {
      this.delete(key);
      return null;
    }

    this.moveToFront(node);
    return node.value.value;
  }

  put(key: string, value: T, ttlMs: number): void {
    const existing = this.cache.get(key);
    if (existing) {
      existing.value.value = value;
      existing.value.expiresAt = Date.now() + ttlMs;
      this.moveToFront(existing);
      return;
    }

    const node: LruNode<T> = {
      key,
      value: { value, expiresAt: Date.now() + ttlMs },
      prev: null,
      next: null,
    };

    this.cache.set(key, node);
    this.addToFront(node);

    if (this.cache.size > this.capacity) {
      this.evictTail();
    }
  }

  delete(key: string): boolean {
    const node = this.cache.get(key);
    if (!node) return false;

    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;

    if (node === this.head) this.head = node.next;
    if (node === this.tail) this.tail = node.prev;

    this.cache.delete(key);
    return true;
  }

  clear(): void {
    this.cache.clear();
    this.head = null;
    this.tail = null;
  }

  private moveToFront(node: LruNode<T>): void {
    this.removeFromList(node);
    this.addToFront(node);
  }

  private addToFront(node: LruNode<T>): void {
    node.prev = null;
    node.next = this.head;
    if (this.head) this.head.prev = node;
    this.head = node;
    if (!this.tail) this.tail = node;
  }

  private removeFromList(node: LruNode<T>): void {
    if (node.prev) node.prev.next = node.next;
    if (node.next) node.next.prev = node.prev;
  }

  private evictTail(): void {
    if (!this.tail) return;

    this.cache.delete(this.tail.key);
    if (this.tail.prev) {
      this.tail.prev.next = null;
    }
    this.tail = this.tail.prev;
    if (this.tail) this.tail.next = null;
    if (!this.tail) this.head = null;
  }

  get size(): number {
    return this.cache.size;
  }
}