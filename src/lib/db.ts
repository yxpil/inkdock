// Author: yxpil

import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { countWords } from "./words";
import { dayKey } from "./utils";

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  handle TEXT NOT NULL UNIQUE,
  avatar_color TEXT NOT NULL,
  password_hash TEXT NOT NULL DEFAULT '',
  password_salt TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at);

CREATE TABLE IF NOT EXISTS works (
  id TEXT PRIMARY KEY,
  author_id TEXT NOT NULL REFERENCES users(id),
  title TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  genre TEXT NOT NULL DEFAULT '其他',
  tags TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL DEFAULT 'serializing'
    CHECK (status IN ('serializing', 'completed', 'paused')),
  cover_color TEXT NOT NULL,
  cover_image TEXT,
  target_words INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_works_author ON works(author_id, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_works_status ON works(status);

CREATE TABLE IF NOT EXISTS work_members (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('owner', 'editor', 'commenter', 'reader')),
  created_at TEXT NOT NULL,
  UNIQUE(work_id, user_id)
);

CREATE TABLE IF NOT EXISTS volumes (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL DEFAULT '',
  sort REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_volumes_work ON volumes(work_id, sort);

CREATE TABLE IF NOT EXISTS chapters (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  volume_id TEXT NOT NULL REFERENCES volumes(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'ready', 'published')),
  sort REAL NOT NULL,
  word_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_chapters_volume ON chapters(volume_id, sort);
CREATE INDEX IF NOT EXISTS idx_chapters_work ON chapters(work_id, deleted_at);
CREATE INDEX IF NOT EXISTS idx_chapters_updated ON chapters(updated_at DESC);

CREATE TABLE IF NOT EXISTS story_entities (
  id TEXT PRIMARY KEY,
  work_id TEXT NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  type TEXT NOT NULL
    CHECK (type IN ('character', 'organization', 'location', 'item', 'concept')),
  name TEXT NOT NULL,
  subtitle TEXT NOT NULL DEFAULT '',
  summary TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  color TEXT NOT NULL,
  sort REAL NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_story_entities_work
  ON story_entities(work_id, type, sort);

CREATE TABLE IF NOT EXISTS chapter_illustrations (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  paragraph INTEGER NOT NULL DEFAULT 0,
  caption TEXT NOT NULL DEFAULT '',
  image_mime TEXT NOT NULL CHECK (image_mime IN ('jpeg', 'png', 'webp')),
  image_data BLOB NOT NULL,
  width INTEGER NOT NULL,
  height INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_chapter_illustrations_chapter
  ON chapter_illustrations(chapter_id, paragraph, created_at);

CREATE TABLE IF NOT EXISTS revisions (
  id TEXT PRIMARY KEY,
  chapter_id TEXT NOT NULL REFERENCES chapters(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  word_count INTEGER NOT NULL,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_revisions_chapter ON revisions(chapter_id, created_at DESC);

CREATE TABLE IF NOT EXISTS daily_stats (
  day TEXT NOT NULL,
  user_id TEXT NOT NULL REFERENCES users(id),
  words INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (day, user_id)
);
`;

export const LOCAL_USER_ID = "local-user";

type GlobalWithDb = typeof globalThis & { __inkdockDb?: DatabaseSync };

function openDatabase(): DatabaseSync {
  const file = process.env.INK_DB_PATH
    ? path.resolve(process.env.INK_DB_PATH)
    : path.join(process.cwd(), "data", "inkdock.db");
  fs.mkdirSync(path.dirname(file), { recursive: true });

  const db = new DatabaseSync(file);
  db.exec("PRAGMA journal_mode = WAL;");
  db.exec("PRAGMA foreign_keys = ON;");
  db.exec("PRAGMA busy_timeout = 5000;");
  db.exec("PRAGMA synchronous = NORMAL;");

  db.exec(SCHEMA);
  migrateDatabase(db);

  seedDatabase(db);
  return db;
}

function migrateDatabase(db: DatabaseSync): void {
  const workColumns = db.prepare("PRAGMA table_info(works)").all() as Array<{ name: string }>;
  if (!workColumns.some((column) => column.name === "cover_image")) {
    db.exec("ALTER TABLE works ADD COLUMN cover_image TEXT;");
  }

  const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
  if (!userColumns.some((column) => column.name === "password_hash")) {
    db.exec("ALTER TABLE users ADD COLUMN password_hash TEXT NOT NULL DEFAULT '';");
  }
  if (!userColumns.some((column) => column.name === "password_salt")) {
    db.exec("ALTER TABLE users ADD COLUMN password_salt TEXT NOT NULL DEFAULT '';");
  }

  db.exec(`
    INSERT INTO work_members (id, work_id, user_id, role, created_at)
    SELECT lower(hex(randomblob(16))), w.id, w.author_id, 'owner', w.created_at
    FROM works w
    WHERE NOT EXISTS (
      SELECT 1 FROM work_members m
      WHERE m.work_id = w.id AND m.user_id = w.author_id
    );
  `);

  const version = db.prepare("PRAGMA user_version").get() as
    | { user_version: number }
    | undefined;
  if (!version || version.user_version < 4) {
    db.exec("PRAGMA user_version = 4;");
  }
}

export function getDb(): DatabaseSync {
  const globalRef = globalThis as GlobalWithDb;
  if (!globalRef.__inkdockDb) {
    globalRef.__inkdockDb = openDatabase();
  }
  return globalRef.__inkdockDb;
}

function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

const FOG_HARBOR_ONE = `雨从傍晚落到现在，没有停过。

末班渡轮靠岸时，雾港的钟楼正好敲了十一下。码头只剩两盏灯，一盏照着湿透的木栈道，一盏照着检票口那张褪色的告示。许砚把风衣领口拢紧，踩着水洼走上岸。

他已经十年没有回来。

售票亭里没有人。窗台上压着一只牛皮纸信封，边角被雨水洇出深色。信封正面只写了三个字：许砚收。

字迹很轻，像怕被纸记住。

他环顾四周。候船室里空无一人，长椅上的油漆起了皮，墙角的海图被人撕掉一半，只留下雾港以北那片空白。渡轮已经调头，船尾的灯在雾里一明一暗，像有人在远处眨眼。

信封没有封口。里面是一张旧照片和一张薄薄的信纸。

照片上是十年前的“白鹭号”，船身侧倾，甲板上的人影模糊成一团。许砚认得站在最右边的那个少年。那是他的弟弟，许澄。官方记录里，许澄在那场事故中失踪，连遗体都没有找到。

信纸上只有一句话：

“他还在第七码头等你。”

许砚的手指停在“第七码头”四个字上。雾港只有六个码头。至少，十年前是六个。

身后传来脚步声。他回头，看见一个穿深色雨衣的老人站在灯影外，手里提着一盏没有点亮的煤油灯。

“你是许家的老大？”老人问。

“你是谁？”

老人没有回答，只抬起下巴，朝售票亭的方向示意。“信送到了，我就该走了。天黑以后，别去海边。尤其是起雾的时候。”

“等等。”

老人转身，雨衣下摆扫过积水。许砚追出两步，又停住。他忽然想起，自己小时候也见过这个老人。那时老人坐在灯塔下面，替人修补渔网，谁也不知道他的名字。孩子们叫他“守夜人”。

等许砚再抬眼，码头已经空了。只有那句话留在信纸上，被潮气慢慢润开。

他低头看照片。照片背面有一行几乎褪尽的铅笔字，是弟弟的笔迹。

“哥，如果我回不来，替我去看看海。”

雨声忽然大了。远处，雾里传来一声短促的汽笛。可这个时间，不该有船。`;

const FOG_HARBOR_TWO = `许砚在码头附近的旧旅馆住下。

旅馆叫“潮生”，只有三层，前台摆着一台很久没有响过的电话。老板娘把钥匙推过来，看了他一眼，说三楼靠海那间空了很多年，问他介不介意。

他说不介意。

房间里有股木头受潮后的味道。窗子正对港口，雾把远处的灯揉成了几团模糊的光。许砚把照片摊在桌上，给在城里做警察的同学打了电话。

“白鹭号？”对方在电话那头沉默了一会儿，“那案子不是结了吗？机械故障，船体进水。遇难者名单里有你弟弟。”

“名单上写的是失踪。”

“许砚，十年了。”

“我知道。”

对方叹了口气，说帮他查查第七码头。挂电话前，又补了一句：“你别一个人乱跑。雾港那地方，外地人容易迷路。”

许砚应了一声。他没有告诉对方，自己不是外地人。

夜里十二点，他被一阵敲门声惊醒。

门外没有人。地毯上放着一只牛皮纸信封，和码头上那只一模一样。里面掉出一张剪报，日期是十年前六月十七日，标题只有半行：

《白鹭号事故调查结束 三名船员下落不明》

剪报边缘被人用铅笔圈了一处。那是遇难者名单的最后一行。

许澄，十九岁，见习水手。

可照片上的许澄穿着救生衣，站在甲板最右侧。许砚记得这件救生衣。事故前一天，弟弟曾给他打过一个电话，说自己领到了一件新救生衣，橙色的，很显眼。

“哥，你猜我在船上看见谁了？”

那天信号不好，许砚没听清后半句。电话就断了。

他把剪报翻过来。背面用红笔写着一串数字：0703。

不是日期，也不像电话号码。

许砚把数字抄在手心，走到窗边。雾更重了，港口只剩一盏灯。灯光下面，有个穿雨衣的人正抬头看他的窗户。

他下意识后退一步。

等他再靠近，街上已经没有人了。只有积水里浮着一张被雨打湿的纸，缓慢地打着转。纸上的字被泡得发胀，仍能认出来，是弟弟的笔迹。

“别相信灯塔上的人。”`;

const FOG_HARBOR_THREE = `第二天清晨，雾散了一些。

许砚沿着海岸线往北走，路过废弃的修船厂、关门的鱼市，最后在礁石尽头看见那座白塔。灯塔比记忆里矮，墙皮剥落，铁门半掩。门口的牌子上写着“危房勿入”，锁却被人剪断了。

塔里很暗。螺旋楼梯上积着沙，墙面上刻满了名字和日期。许砚打着手机的光往上走，在三层拐角处停住。

墙上有一行新刻的字：

“许澄，二〇一四年六月十六日。”

字迹很浅，刻的人似乎力气不够。许砚伸手摸了摸石屑，指尖沾着细白的粉。这不是十年前的痕迹。

顶层是灯室。巨大的透镜落满灰，窗外能看见整个雾港。许砚数了一遍码头。从北到南，六个。没有第七个。

他在角落发现一张折叠床和一只旧水壶。床头压着一本值班记录，最后一页停在三天前。记录的人每天只写两句话：风向，以及“他没来”。

昨天的记录却不是字，而是一幅很简单的图。六个方块排成一列，最右边多画了一块，旁边写着“七”。

许砚把记录本合上，听见楼下传来脚步声。

老人站在楼梯口，仍穿着那件深色雨衣。这次他手里提着一盏亮着的煤油灯。

“我说过，天黑以后别来海边。”老人说。

“现在是白天。”

“雾港的白天，也不一定看得见东西。”

许砚举起那本记录。“这是你写的？”

老人没有否认。“我守了三十年灯。风大的时候，灯照不远。那年六月，海上起了雾，白鹭号本来不该出港。”

“为什么出港？”

老人看着他，沟壑很深的脸上没有表情。“有人下了命令。”

“谁？”

“你弟弟没告诉你吗？”

许砚愣住。老人把煤油灯放在窗台上，火苗晃了一下，映出灯罩内侧一行细小的字。许砚俯下身，辨认了很久。

“第七码头不在海上。”老人说，“在下面。”

他指了指脚下。

许砚低头，看见地板的缝隙里渗出一线湿痕。那湿痕正沿着砖缝缓慢延伸，像一条刚刚醒来的蛇。灯塔外，雾重新聚拢，港口的方向传来一声闷响，像有什么沉重的东西，从很深的地方浮了上来。`;

const FOG_HARBOR_FOUR = `许砚回到旅馆时，前台没有人。

电话在响。铃声短而急，像有人用手指不停压着话筒。他接起来，听筒里只有海水的声音，哗啦，哗啦，间隔很长。

“喂？”

对面的呼吸停了一拍。

“哥。”

许砚握住话筒的手收紧了。“许澄？”

“别开灯。”弟弟的声音很轻，像隔着一层水，“他们看得见光。”

“你在哪？”

“旧码头。船下面。”

电话断了。

许砚站在原地，听见自己的心跳。窗外，雨又落下来，敲在铁皮雨棚上。他拉开窗帘，港口一片漆黑，只有灯塔顶部的光缓慢旋转。

他找出那串数字 0703，又翻开剪报。六月十七日。零七零三。第七码头，三层？

楼下传来开门声。

老板娘拎着一袋菜走进来，看见他站在前台，愣了一下。“这么晚还没睡？”

“旅馆下面有几层？”

“三层啊。”她把伞靠在门边，“哦，还有个地下室，早就不用了。以前是放渔具的。后来漏水，封了。”

“入口在哪？”

老板娘看了他一会儿，笑容慢慢收了。“许先生，你问这个做什么？”

许砚没有回答。

她低下头，整理购物袋里的东西，声音小了许多。“我劝你别去。你弟弟那件事，过去就过去了。人活着，总要往前看。”

“你认识我弟弟？”

“雾港就这么大。”她说，“谁家的事，大家都知道一点。”

“那你知不知道，白鹭号那天为什么出港？”

老板娘把一袋土豆放到柜台上。袋子碰到木面，发出一声闷响。“因为船上有个孩子。”

“什么孩子？”

“船长的。”她说，“六岁。那天也在船上。”

许砚记得遇难者名单。没有孩子。

他转身往楼上走。走到一半，老板娘在身后叫住他。

“许先生，如果今晚有人敲门，别开。”

“为什么？”

“因为这家旅馆，只有我一个人值夜。”

许砚停在楼梯上。走廊的灯闪了一下，又暗下去。

午夜过后，敲门声准时响起。`;

const FOG_HARBOR_FIVE = `地下室的门在储藏间最里面，被一排空酒箱挡住。

许砚把箱子搬开，看见门板上钉着一条防潮布。布已经发硬，边缘用白漆写了一个模糊的数字：7。

门后没有楼梯。

只有一面潮湿的砖墙，和墙根处一条能容一人侧身通过的裂缝。裂缝里有风，带着海水的咸味。

许砚打开手机的手电筒。光照进去，照见一块旧木牌，斜插在碎石里。

木牌上写着三个字：第七码头。`;

const QUARRY_ONE = `采石场在城北，最后一班通勤车每天下午五点四十发车。

林满在门口等了十分钟。门卫室的小窗开着，里面没有人，桌上的收音机还在播天气预报。风把桌上的值班表吹起一角，露出下面压着的照片。

照片上是十几张年轻的脸，站在采石场的台阶上，背后是白得刺眼的石壁。

林满认出其中一个。那是她的父亲。

她拿起照片，翻到背面。上面用圆珠笔写着一行日期，距今二十三年。日期后面还有几个字，被人用力划掉了，只剩纸面凹陷的痕迹。

通勤车在远处按了一声喇叭。

林满把照片放回原处，转身上车。车上只有四个人：司机、一个打瞌睡的老人、一个抱着纸箱的女人，以及她。

车子开进矿区时，天色已经暗了。石壁在窗外缓缓升起，像一面没有尽头的墙。林满贴着玻璃看了一会儿，发现墙上每隔十来米就有一个小洞。

洞口新的，边缘没有灰尘。

她问司机那是什么。

司机没有回头，只把后视镜扳正了一点。“风眼。”他说，“石头也要喘气。”

林满不懂。她低下头，给母亲发了一条消息，说自己到了。

消息旁边转了很久的圈，最后变成一个红色感叹号。

手机没有信号。`;

const QUARRY_TWO = `名单贴在食堂门口，纸已经泛黄。

上面是二十三年前那场塌方后离开矿区的人。林满从上往下看，在最后一行看见父亲的名字。名字后面本该写去向，却只有一道横线。

食堂里有人在收拾桌子。铝盆碰在一起，声音很响。

“你是林东海的女儿？”有人问。

林满回头。一个系着围裙的女人站在窗口里，头发花白，手里还端着一盆没倒完的面汤。

“你认识我爸？”

女人把盆放下，擦了擦手。“他救过人。”

“我知道。”

“你不知道。”女人看着她，声音很低，“他救的人，不在这张名单上。”

窗外，最后一班通勤车发动了。车灯扫过食堂的玻璃，名单上的名字被光照亮，又暗下去。

林满看见最后一行多了一个影子。

像是有人站在她身后，伸手按住了父亲的名字。`;

function seedDatabase(db: DatabaseSync): void {
  const now = new Date();
  const nowIso = now.toISOString();

  const userCount = db.prepare("SELECT COUNT(*) AS n FROM users").get() as {
    n: number;
  };
  if (userCount.n > 0) return;

  db.prepare(
    "INSERT INTO users (id, name, handle, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(LOCAL_USER_ID, "沈砚", "local", "#26594A", minutesAgo(60 * 24 * 120));

  const workOneId = crypto.randomUUID();
  const workOneVolumeOne = crypto.randomUUID();
  const workOneVolumeTwo = crypto.randomUUID();
  const workTwoId = crypto.randomUUID();
  const workTwoVolumeOne = crypto.randomUUID();

  db.prepare(
    `INSERT INTO works
      (id, author_id, title, subtitle, description, genre, tags, status, cover_color, target_words, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workOneId,
    LOCAL_USER_ID,
    "雾港来信",
    "潮水会替人保守秘密，也会把秘密送回来。",
    "雨季第七天，末班渡轮带回一封没有署名的信。信里写着十年前沉船的名字，也写着收信人从未告诉过任何人的乳名。许砚回到雾港，只想确认一件事：那晚从海上消失的，究竟是船，还是所有人关于那晚的记忆。",
    "悬疑",
    "[]",
    "serializing",
    "#2F4B46",
    480000,
    minutesAgo(60 * 24 * 46),
    minutesAgo(42),
  );

  db.prepare(
    `INSERT INTO works
      (id, author_id, title, subtitle, description, genre, tags, status, cover_color, target_words, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).run(
    workTwoId,
    LOCAL_USER_ID,
    "采石场最后一班",
    "石头记得每一个离开的人。",
    "林满回到父亲工作过的采石场，只想取走一份旧档案。最后一班通勤车却没有按时离开。名单、风眼、没有信号的矿区，还有照片上那些年轻的脸，一起把一个被掩埋了二十三年的下午重新推到她的面前。",
    "现实",
    "[]",
    "paused",
    "#A9543C",
    220000,
    minutesAgo(60 * 24 * 80),
    minutesAgo(60 * 24 * 3),
  );

  const insertMember = db.prepare(
    "INSERT INTO work_members (id, work_id, user_id, role, created_at) VALUES (?, ?, ?, 'owner', ?)",
  );
  insertMember.run(crypto.randomUUID(), workOneId, LOCAL_USER_ID, minutesAgo(60 * 24 * 46));
  insertMember.run(crypto.randomUUID(), workTwoId, LOCAL_USER_ID, minutesAgo(60 * 24 * 80));

  const insertVolume = db.prepare(
    "INSERT INTO volumes (id, work_id, title, summary, sort, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
  );
  insertVolume.run(
    workOneVolumeOne,
    workOneId,
    "第一卷 潮声",
    "回到雾港，收到两封没有署名的信。",
    1000,
    minutesAgo(60 * 24 * 46),
    minutesAgo(60 * 24 * 5),
  );
  insertVolume.run(
    workOneVolumeTwo,
    workOneId,
    "第二卷 暗涌",
    "灯塔、地下室，以及那条不该存在的航线。",
    2000,
    minutesAgo(60 * 24 * 4),
    minutesAgo(42),
  );
  insertVolume.run(
    workTwoVolumeOne,
    workTwoId,
    "第一卷 空场",
    "最后一班车，和一张泛黄的名单。",
    1000,
    minutesAgo(60 * 24 * 80),
    minutesAgo(60 * 24 * 3),
  );

  const insertChapter = db.prepare(
    `INSERT INTO chapters
      (id, work_id, volume_id, title, content, status, sort, word_count, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const chapterSeed: Array<{
    workId: string;
    volumeId: string;
    title: string;
    content: string;
    status: "draft" | "ready" | "published";
    sort: number;
    updatedMinutesAgo: number;
  }> = [
    {
      workId: workOneId,
      volumeId: workOneVolumeOne,
      title: "第一章 末班渡轮",
      content: FOG_HARBOR_ONE,
      status: "published",
      sort: 1000,
      updatedMinutesAgo: 60 * 24 * 6,
    },
    {
      workId: workOneId,
      volumeId: workOneVolumeOne,
      title: "第二章 没有署名的信",
      content: FOG_HARBOR_TWO,
      status: "ready",
      sort: 2000,
      updatedMinutesAgo: 60 * 24 * 2,
    },
    {
      workId: workOneId,
      volumeId: workOneVolumeOne,
      title: "第三章 灯塔守夜人",
      content: FOG_HARBOR_THREE,
      status: "draft",
      sort: 3000,
      updatedMinutesAgo: 60 * 24 * 5,
    },
    {
      workId: workOneId,
      volumeId: workOneVolumeTwo,
      title: "第四章 雨里的旧码头",
      content: FOG_HARBOR_FOUR,
      status: "draft",
      sort: 1000,
      updatedMinutesAgo: 60 * 20,
    },
    {
      workId: workOneId,
      volumeId: workOneVolumeTwo,
      title: "第五章 第七码头",
      content: FOG_HARBOR_FIVE,
      status: "draft",
      sort: 2000,
      updatedMinutesAgo: 42,
    },
    {
      workId: workTwoId,
      volumeId: workTwoVolumeOne,
      title: "第一章 灰尘落下来",
      content: QUARRY_ONE,
      status: "ready",
      sort: 1000,
      updatedMinutesAgo: 60 * 24 * 3,
    },
    {
      workId: workTwoId,
      volumeId: workTwoVolumeOne,
      title: "第二章 名单",
      content: QUARRY_TWO,
      status: "draft",
      sort: 2000,
      updatedMinutesAgo: 60 * 24 * 3 + 20,
    },
  ];

  for (const chapter of chapterSeed) {
    insertChapter.run(
      crypto.randomUUID(),
      chapter.workId,
      chapter.volumeId,
      chapter.title,
      chapter.content,
      chapter.status,
      chapter.sort,
      countWords(chapter.content),
      minutesAgo(chapter.updatedMinutesAgo + 60 * 24),
      minutesAgo(chapter.updatedMinutesAgo),
    );
  }

  db.prepare(
    "INSERT INTO daily_stats (day, user_id, words, updated_at) VALUES (?, ?, ?, ?)",
  ).run(dayKey(now), LOCAL_USER_ID, 1260, nowIso);
}
