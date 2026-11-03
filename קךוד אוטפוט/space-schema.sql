-- שדרוג לטבלת ההודעות הקיימת של "המרחב" - מוסיף תמיכה בתגובות (parent_id)
-- להריץ פעם אחת בלשונית ה-Console של מסד ה-D1 בדשבורד של Cloudflare
--
-- שים לב: זה שדרוג לטבלה שכבר קיימת אצלך (זו שנוצרה מהגרסה הקודמת של הקובץ הזה).
-- תגובה היא בסך הכול הודעה רגילה באותה טבלה, עם parent_id שמצביע על ה-id
-- של ההודעה שעליה מגיבים. אצל הודעות רגילות (שאינן תגובה לאף אחד) השדה נשאר NULL.
-- מגבילים בכוונה לרמת הגבה אחת בלבד (אי אפשר להגיב על תגובה) - זה נאכף בקוד
-- ה-Worker, לא בטבלה עצמה.

ALTER TABLE messages ADD COLUMN parent_id TEXT REFERENCES messages(id);

CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages (parent_id);


-- ============================================================
-- למי שמתקין את "המרחב" מאפס (בלי טבלה קיימת בכלל) - במקום שתי
-- הפקודות שלמעלה, מריצים את זה:
-- ============================================================
--
-- CREATE TABLE IF NOT EXISTS messages (
--   id TEXT PRIMARY KEY,
--   content TEXT NOT NULL,
--   created_at INTEGER NOT NULL,
--   parent_id TEXT REFERENCES messages(id)
-- );
--
-- CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages (created_at);
-- CREATE INDEX IF NOT EXISTS idx_messages_parent_id ON messages (parent_id);
