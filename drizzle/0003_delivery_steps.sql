DROP TRIGGER operation_transition;
--> statement-breakpoint
CREATE TRIGGER operation_transition BEFORE UPDATE ON operations BEGIN
 SELECT CASE WHEN OLD.status IN ('Done','Canceled') THEN RAISE(ABORT,'immutable_operation') END;
 SELECT CASE WHEN NOT (
   (OLD.status='Draft' AND NEW.status IN ('Waiting','Ready','Canceled')) OR
   (OLD.status='Waiting' AND NEW.status IN ('Ready','Canceled')) OR
   (OLD.status='Ready' AND NEW.status IN ('Done','Canceled')) OR
   (OLD.kind='delivery' AND OLD.status='Waiting' AND NEW.status='Waiting' AND OLD.picked_at IS NULL AND NEW.picked_at IS NOT NULL AND NEW.packed_at IS OLD.packed_at)
 ) THEN RAISE(ABORT,'invalid_transition') END;
 SELECT CASE WHEN NEW.kind='delivery' AND NEW.status IN ('Ready','Done') AND (NEW.picked_at IS NULL OR NEW.packed_at IS NULL) THEN RAISE(ABORT,'delivery_not_packed') END;
 SELECT CASE WHEN NEW.packed_at IS NOT NULL AND NEW.picked_at IS NULL THEN RAISE(ABORT,'delivery_not_picked') END;
END;
