CREATE TRIGGER operation_transition BEFORE UPDATE ON operations BEGIN
 SELECT CASE WHEN OLD.status IN ('Done','Canceled') THEN RAISE(ABORT,'immutable_operation') END;
 SELECT CASE WHEN NOT ((OLD.status='Draft' AND NEW.status IN ('Waiting','Ready','Canceled')) OR (OLD.status='Waiting' AND NEW.status IN ('Ready','Canceled')) OR (OLD.status='Ready' AND NEW.status IN ('Done','Canceled'))) THEN RAISE(ABORT,'invalid_transition') END;
END;
--> statement-breakpoint
CREATE TRIGGER operation_validate BEFORE UPDATE OF status ON operations WHEN NEW.status='Done' BEGIN
 SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM lines WHERE operation_id=NEW.id) THEN RAISE(ABORT,'invalid_document') END;
 SELECT CASE WHEN (NEW.kind='receipt' AND NEW.dest_id IS NULL) OR (NEW.kind IN ('delivery','adjustment','transfer') AND NEW.source_id IS NULL) OR (NEW.kind='transfer' AND (NEW.dest_id IS NULL OR NEW.dest_id=NEW.source_id)) THEN RAISE(ABORT,'invalid_document') END;
 SELECT CASE WHEN EXISTS(SELECT 1 FROM lines WHERE operation_id=NEW.id AND NEW.kind!='adjustment' AND qty<=0) THEN RAISE(ABORT,'invalid_document') END;
 SELECT CASE WHEN NEW.kind='adjustment' AND EXISTS(SELECT 1 FROM lines l WHERE l.operation_id=NEW.id AND (l.expected_qty IS NULL OR l.expected_qty != COALESCE((SELECT qty FROM balances WHERE product_id=l.product_id AND location_id=NEW.source_id),0))) THEN RAISE(ABORT,'stale_count') END;
END;
--> statement-breakpoint
CREATE TRIGGER operation_apply AFTER UPDATE OF status ON operations WHEN NEW.status='Done' BEGIN
 INSERT INTO movements(operation_id,product_id,location_id,delta,balance_after,created_at)
 SELECT NEW.id,l.product_id,NEW.source_id,CASE WHEN NEW.kind='adjustment' THEN l.qty-COALESCE(b.qty,0) ELSE -l.qty END,CASE WHEN NEW.kind='adjustment' THEN l.qty ELSE COALESCE(b.qty,0)-l.qty END,NEW.updated_at
 FROM lines l LEFT JOIN balances b ON b.product_id=l.product_id AND b.location_id=NEW.source_id WHERE l.operation_id=NEW.id AND NEW.kind IN ('delivery','transfer','adjustment');
 INSERT INTO movements(operation_id,product_id,location_id,delta,balance_after,created_at)
 SELECT NEW.id,l.product_id,NEW.dest_id,l.qty,COALESCE(b.qty,0)+l.qty,NEW.updated_at
 FROM lines l LEFT JOIN balances b ON b.product_id=l.product_id AND b.location_id=NEW.dest_id WHERE l.operation_id=NEW.id AND NEW.kind IN ('receipt','transfer');
END;
--> statement-breakpoint
CREATE TRIGGER movement_apply AFTER INSERT ON movements BEGIN
 INSERT INTO balances(product_id,location_id,qty) VALUES(NEW.product_id,NEW.location_id,NEW.balance_after)
 ON CONFLICT(product_id,location_id) DO UPDATE SET qty=NEW.balance_after;
END;
--> statement-breakpoint
CREATE TRIGGER movement_no_edit BEFORE UPDATE ON movements BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER movement_no_delete BEFORE DELETE ON movements BEGIN SELECT RAISE(ABORT,'immutable_ledger'); END;
--> statement-breakpoint
CREATE TRIGGER lines_no_edit BEFORE UPDATE ON lines WHEN (SELECT status FROM operations WHERE id=OLD.operation_id)!='Draft' BEGIN SELECT RAISE(ABORT,'immutable_line'); END;
--> statement-breakpoint
CREATE TRIGGER lines_no_delete BEFORE DELETE ON lines WHEN (SELECT status FROM operations WHERE id=OLD.operation_id)!='Draft' BEGIN SELECT RAISE(ABORT,'immutable_line'); END;
--> statement-breakpoint
CREATE TRIGGER lines_no_append BEFORE INSERT ON lines WHEN (SELECT status FROM operations WHERE id=NEW.operation_id)!='Draft' BEGIN SELECT RAISE(ABORT,'immutable_line'); END;
