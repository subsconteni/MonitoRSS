import {
  Entity,
  Property,
  PrimaryKey,
  Enum,
  Index,
  OneToOne,
} from "@mikro-orm/core";
import { ArticleDeliveryStatus } from "../../shared";
import { ArticleDeliveryContentType } from "../../shared/types/article-delivery-content-type.type";

@Entity()
@Index({
  properties: ["feed_id", "status", "created_at"],
  name: "delivery_timeframe_count_index",
})
export class DeliveryRecord {
  @PrimaryKey()
  id: string;

  @Property()
  feed_id: string;

  @Property()
  medium_id: string;

  @Property()
  created_at: Date = new Date();

  @Enum(() => ArticleDeliveryStatus)
  status: ArticleDeliveryStatus;

  @Enum({
    nullable: true,
    items: () => ArticleDeliveryContentType,
  })
  content_type?: ArticleDeliveryContentType | null;

  @OneToOne({
    nullable: true,
    default: null,
    entity: () => DeliveryRecord,
  })
  parent?: DeliveryRecord | null;

  @Property({
    nullable: true,
    type: "text",
  })
  internal_message?: string;

  @Property({
    nullable: true,
  })
  error_code?: string;

  constructor(
    data: Omit<DeliveryRecord, "created_at">,
    overrides?: {
      created_at?: Date;
    }
  ) {
    this.id = data.id;
    this.feed_id = data.feed_id;
    this.status = data.status;
    this.error_code = data.error_code;
    this.internal_message = data.internal_message;
    this.medium_id = data.medium_id;

    if (overrides?.created_at) {
      this.created_at = overrides.created_at;
    }
  }
}
