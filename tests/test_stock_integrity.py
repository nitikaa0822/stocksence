"""Run with python -m unittest discover -s tests -v. Uses the real SQL migrations."""
import sqlite3
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

class StockIntegrity(unittest.TestCase):
    def setUp(self):
        self.db = sqlite3.connect(':memory:', isolation_level=None)
        self.db.execute('PRAGMA foreign_keys=ON')
        for migration in sorted((ROOT / 'drizzle').glob('*.sql')):
            self.db.executescript(migration.read_text(encoding='utf-8'))
        for p in ['steel', 'bolts']:
            self.db.execute('INSERT INTO products(id,owner,name,sku,category,unit) VALUES(?,?,?,?,?,?)', (p,'team',p,p,'Raw material','kg'))
        for location in ['main','rack']:
            self.db.execute('INSERT INTO locations VALUES(?,?,?,?)',(location,'team','Warehouse',location))
        self.counter=0

    def tearDown(self):
        self.db.close()

    def operation(self, kind, qty, source=None, dest=None, product='steel', expected=None):
        self.counter+=1
        oid=f'op-{self.counter}'
        self.db.execute('INSERT INTO operations(id,owner,reference,kind,source_id,dest_id,actor,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)',(oid,'team',oid,kind,source,dest,'tester','2026-09-26','2026-09-26'))
        self.db.execute('INSERT INTO lines VALUES(?,?,?,?,?)',(oid+'-line',oid,product,qty,expected))
        return oid

    def ready(self, oid):
        if self.db.execute('SELECT kind FROM operations WHERE id=?',(oid,)).fetchone()[0]=='delivery':
            self.db.execute("UPDATE operations SET status='Waiting',picked_at='2026-09-26T10:00:00Z' WHERE id=?",(oid,))
            self.db.execute("UPDATE operations SET status='Ready',packed_at='2026-09-26T10:01:00Z' WHERE id=?",(oid,))
        else:
            self.db.execute("UPDATE operations SET status='Ready' WHERE id=?",(oid,))

    def validate(self, oid):
        return self.db.execute("UPDATE operations SET status='Done' WHERE id=? AND status='Ready'",(oid,)).rowcount

    def receive(self, qty=100000, product='steel'):
        oid=self.operation('receipt',qty,dest='main',product=product)
        self.ready(oid); self.validate(oid)
        return oid

    def qty(self, product='steel', location='main'):
        row=self.db.execute('SELECT qty FROM balances WHERE product_id=? AND location_id=?',(product,location)).fetchone()
        return row[0] if row else 0

    def test_full_journey_ends_at_77(self):
        self.receive()
        transfer=self.operation('transfer',40000,'main','rack')
        self.ready(transfer);self.validate(transfer)
        self.assertEqual((self.qty(),self.qty(location='rack')),(60000,40000))
        delivery=self.operation('delivery',20000,'main')
        self.ready(delivery);self.validate(delivery)
        adjustment=self.operation('adjustment',37000,'main',expected=40000)
        self.ready(adjustment);self.validate(adjustment)
        self.assertEqual(self.qty()+self.qty(location='rack'),77000)
        self.assertEqual(self.db.execute('SELECT sum(delta) FROM movements').fetchone()[0],77000)

    def test_draft_does_not_change_stock(self):
        self.operation('receipt',100000,dest='main')
        self.assertEqual(self.qty(),0)

    def test_duplicate_validation_changes_stock_once(self):
        oid=self.receive()
        self.assertEqual(self.validate(oid),0)
        self.assertEqual(self.qty(),100000)
        self.assertEqual(self.db.execute('SELECT count(*) FROM movements').fetchone()[0],1)

    def test_insufficient_stock_rolls_back_document(self):
        self.receive(1000)
        oid=self.operation('delivery',2000,'main');self.ready(oid)
        with self.assertRaisesRegex(sqlite3.IntegrityError,'stock_nonnegative'):
            self.validate(oid)
        self.assertEqual(self.qty(),1000)
        self.assertEqual(self.db.execute('SELECT status FROM operations WHERE id=?',(oid,)).fetchone()[0],'Ready')
        self.assertEqual(self.db.execute('SELECT count(*) FROM movements WHERE operation_id=?',(oid,)).fetchone()[0],0)

    def test_multiline_delivery_rolls_back_every_line(self):
        self.receive(100000);self.receive(1000,'bolts')
        oid=self.operation('delivery',10000,'main')
        self.db.execute('INSERT INTO lines VALUES(?,?,?,?,NULL)',('extra',oid,'bolts',2000))
        self.ready(oid)
        with self.assertRaises(sqlite3.IntegrityError):self.validate(oid)
        self.assertEqual((self.qty(),self.qty('bolts')),(100000,1000))
        self.assertEqual(self.db.execute('SELECT count(*) FROM movements WHERE operation_id=?',(oid,)).fetchone()[0],0)

    def test_failed_transfer_changes_neither_location(self):
        self.receive(1000)
        oid=self.operation('transfer',2000,'main','rack');self.ready(oid)
        with self.assertRaises(sqlite3.IntegrityError):self.validate(oid)
        self.assertEqual((self.qty(),self.qty(location='rack')),(1000,0))

    def test_stale_count_rejected(self):
        self.receive(1000)
        count=self.operation('adjustment',800,'main',expected=1000);self.ready(count)
        self.receive(500)
        with self.assertRaisesRegex(sqlite3.IntegrityError,'stale_count'):self.validate(count)
        self.assertEqual(self.qty(),1500)

    def test_zero_count_is_valid(self):
        self.receive(1000)
        count=self.operation('adjustment',0,'main',expected=1000);self.ready(count);self.validate(count)
        self.assertEqual(self.qty(),0)

    def test_same_location_transfer_rejected(self):
        self.receive()
        oid=self.operation('transfer',1000,'main','main');self.ready(oid)
        with self.assertRaisesRegex(sqlite3.IntegrityError,'invalid_document'):self.validate(oid)

    def test_final_documents_and_ledger_immutable(self):
        oid=self.receive()
        for query in ["UPDATE operations SET status='Draft' WHERE id=?",'DELETE FROM lines WHERE operation_id=?', 'UPDATE movements SET delta=999 WHERE operation_id=?','DELETE FROM movements WHERE operation_id=?']:
            with self.assertRaisesRegex(sqlite3.IntegrityError,'immutable'):self.db.execute(query,(oid,))

    def test_cancel_does_not_change_stock(self):
        oid=self.operation('receipt',100000,dest='main')
        self.db.execute("UPDATE operations SET status='Canceled' WHERE id=?",(oid,))
        self.assertEqual(self.validate(oid),0)
        self.assertEqual(self.qty(),0)

    def test_fractional_units_are_exact(self):
        self.receive(1001)
        oid=self.operation('delivery',1,'main');self.ready(oid);self.validate(oid)
        self.assertEqual(self.qty(),1000)



    def test_delivery_cannot_skip_pick_and_pack(self):
        oid=self.operation('delivery',1000,'main')
        with self.assertRaisesRegex(sqlite3.IntegrityError,'delivery_not_packed'):
            self.db.execute("UPDATE operations SET status='Ready' WHERE id=?",(oid,))
        self.assertEqual(self.qty(),0)

    def test_picking_does_not_reduce_stock(self):
        self.receive(5000)
        oid=self.operation('delivery',1000,'main')
        self.ready(oid)
        self.assertEqual(self.qty(),5000)
        self.validate(oid)
        self.assertEqual(self.qty(),4000)

if __name__=='__main__':unittest.main()
