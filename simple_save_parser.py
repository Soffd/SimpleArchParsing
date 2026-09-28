#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Simple (com.gooseeggstudio.simple) 存档解析器
==============================================

游戏: Simple - Goose Egg Studio (Unity IL2CPP + xLua 音游/剧情游戏)
存档: <persistentDataPath>/player0.save
  Android 通常位于:
    /sdcard/Android/data/com.gooseeggstudio.simple/files/player0.save
  (另有一个 logs.save 是运行日志, 非存档)

格式: Google Protobuf (proto3) 二进制, 顶层消息 SimpleProto.PlayerInfo
      消息定义通过分析 APK 内 IL2CPP 元数据(global-metadata.dat)中
      内嵌的 FileDescriptorProto 还原而来:

  message PlayerInfo {
    string playerName = 1;
    repeated SongScore scores = 2;
    map<string, bool> unlockedStatus = 3;
    string unionId = 4;
    string deviceInfo = 5;
  }

  message SongScore {
    Chapter chapter = 1;
    string musicName = 2;
    Hard hard = 3;
    // 4..9 未使用(历史遗留)
    int32 perfect = 10;
    int32 earlyGood = 11;
    int32 lateGood = 12;
    int32 earlyBad = 13;
    int32 lateBad = 14;
    int32 miss = 15;
    int32 fullComboCount = 16;
    int32 maxComboCount = 17;
  }

  enum Chapter { Invalid=0; Chapter1=1; Chapter2=2; Crystle=3; Public=4;
                 Huanyun=5; Start=9000; Single=9001; AprilFool=9002; }
  enum Hard { Sp=0; Cm=1; Cl=2; Ol=3; }

用法:
  python3 simple_save_parser.py player0.save                  # 完整 JSON
  python3 simple_save_parser.py player0.save --summary        # 人性化摘要
  python3 simple_save_parser.py player0.save --raw            # 通用 TLV 转储(无需 schema)
  python3 simple_save_parser.py player0.save --music cfg_Config_Music.txt
  python3 simple_save_parser.py --hex "0A0B546573746572..."  # 直接解析 hex 字符串
  python3 simple_save_parser.py --base64 "CgpTb2ZmZEBsaW5l..."  # 直接解析同步码
  python3 simple_save_parser.py player0.save -o out.json

无第三方依赖 (纯 Python 3, 手工 protobuf wire-format 实现)。
"""

import sys
import json
import gzip
import zlib
import base64

__version__ = '1.0'

# ---------------------------------------------------------------- 枚举映射 --

CHAPTER_NAMES = {
    0: 'Invalid',
    1: 'Chapter1',
    2: 'Chapter2',
    3: 'Crystle',
    4: 'Public',
    5: 'Huanyun',
    9000: 'Start',
    9001: 'Single',
    9002: 'AprilFool2026',
}

HARD_NAMES = {0: 'Sp', 1: 'Cm', 2: 'Cl', 3: 'Ol'}

MUSIC_NAME_FIELDS  = (1, 'playerName', 2)

# ------------------------------------------------------------ protobuf IO --


def read_varint(buf, pos, end=None):
    """读取 varint, 返回 (值, 新位置)。"""
    if end is None:
        end = len(buf)
    result = 0
    shift = 0
    while True:
        if pos >= end:
            raise ValueError('varint 越界')
        b = buf[pos]
        pos += 1
        result |= (b & 0x7F) << shift
        if not (b & 0x80):
            return result, pos
        shift += 7
        if shift > 70:
            raise ValueError('varint 过长')


def write_varint(value):
    out = bytearray()
    while True:
        b = value & 0x7F
        value >>= 7
        if value:
            out.append(b | 0x80)
        else:
            out.append(b)
            return bytes(out)


def iter_fields(buf, start=0, end=None):
    """通用 protobuf 字段迭代器。

    依次 yield (field_no, wire_type, value):
      wire_type 0 (varint)  -> int
      wire_type 1 (fixed64) -> bytes(8)
      wire_type 2 (len)     -> bytes
      wire_type 5 (fixed32) -> bytes(4)
    """
    if end is None:
        end = len(buf)
    pos = start
    while pos < end:
        tag, pos = read_varint(buf, pos, end)
        field_no = tag >> 3
        wire = tag & 7
        if field_no == 0:
            raise ValueError('非法字段号 0')
        if wire == 0:
            val, pos = read_varint(buf, pos, end)
            yield field_no, wire, val
        elif wire == 1:
            if pos + 8 > end:
                raise ValueError('fixed64 越界')
            val, pos = buf[pos:pos + 8], pos + 8
            yield field_no, wire, val
        elif wire == 2:
            ln, pos = read_varint(buf, pos, end)
            if pos + ln > end:
                raise ValueError('长度前缀越界')
            val, pos = buf[pos:pos + ln], pos + ln
            yield field_no, wire, val
        elif wire == 5:
            if pos + 4 > end:
                raise ValueError('fixed32 越界')
            val, pos = buf[pos:pos + 4], pos + 4
            yield field_no, wire, val
        else:
            raise ValueError('不支持的 wire type %d' % wire)


def dec_str(raw):
    try:
        return raw.decode('utf-8')
    except Exception:
        return raw.decode('utf-8', 'replace')


def raw_repr(val):
    if isinstance(val, int):
        return val
    return val.hex()


# ------------------------------------------------------------- 消息解析器 --


def parse_map_entry(buf):
    """解析 map<string, bool> 的 UnlockedStatusEntry。"""
    key, value = None, None
    for fno, wire, val in iter_fields(buf):
        if fno == 1:
            key = dec_str(val) if wire == 2 else val
        elif fno == 2:
            value = bool(val) if wire == 0 else val
    return key, value


def parse_song_score(buf):
    o = {
        'chapter': 0, 'chapterName': 'Invalid',
        'musicName': '',
        'hard': 0, 'hardName': 'Sp',
        'perfect': 0, 'earlyGood': 0, 'lateGood': 0,
        'earlyBad': 0, 'lateBad': 0, 'miss': 0,
        'fullComboCount': 0, 'maxComboCount': 0,
    }
    unknown = []
    int_fields = {1: 'chapter', 3: 'hard',
                  10: 'perfect', 11: 'earlyGood', 12: 'lateGood',
                  13: 'earlyBad', 14: 'lateBad', 15: 'miss',
                  16: 'fullComboCount', 17: 'maxComboCount'}
    for fno, wire, val in iter_fields(buf):
        if fno == 2 and wire == 2:
            o['musicName'] = dec_str(val)
        elif fno in int_fields and wire == 0:
            o[int_fields[fno]] = val
        else:
            unknown.append({'field': fno, 'wiretype': wire, 'raw': raw_repr(val)})
    o['chapterName'] = CHAPTER_NAMES.get(o['chapter'], str(o['chapter']))
    o['hardName'] = HARD_NAMES.get(o['hard'], str(o['hard']))
    o['totalNotes'] = (o['perfect'] + o['earlyGood'] + o['lateGood']
                       + o['earlyBad'] + o['lateBad'] + o['miss'])
    if unknown:
        o['_unknown'] = unknown
    return o


def parse_player_info(buf):
    """解析顶层 SimpleProto.PlayerInfo 消息。"""
    info = {
        'playerName': '',
        'scores': [],
        'unlockedStatus': {},
        'unionId': '',
        'deviceInfo': '',
        '_format': 'protobuf/SimpleProto.PlayerInfo',
    }
    unknown = []
    for fno, wire, val in iter_fields(buf):
        if fno == 1 and wire == 2:
            info['playerName'] = dec_str(val)
        elif fno == 2 and wire == 2:
            info['scores'].append(parse_song_score(val))
        elif fno == 3 and wire == 2:
            key, value = parse_map_entry(val)
            if key is not None:
                info['unlockedStatus'][key] = value
        elif fno == 4 and wire == 2:
            info['unionId'] = dec_str(val)
        elif fno == 5 and wire == 2:
            info['deviceInfo'] = dec_str(val)
        else:
            unknown.append({'field': fno, 'wiretype': wire, 'raw': raw_repr(val)})
    if unknown:
        info['_unknown'] = unknown
    return info


def dump_raw(buf):
    """--raw 模式: 不做 schema 映射, 输出顶层 TLV。"""
    out = []
    for fno, wire, val in iter_fields(buf):
        item = {'field': fno, 'wiretype': wire}
        if wire == 2:
            try:
                txt = val.decode('utf-8')
                if txt.isprintable():
                    item['string'] = txt
                else:
                    raise ValueError
            except Exception:
                item['bytes'] = val.hex()
                item['len'] = len(val)
        else:
            item['value'] = raw_repr(val)
        out.append(item)
    return out


# ------------------------------------------------------------- 容器检测 --


def unwrap(buf):
    """返回 [(数据, 容器描述)] 候选列表, 依次尝试。"""
    cands = [(buf, 'raw')]
    if buf[:2] == b'\x1f\x8b':
        try:
            cands.insert(0, (gzip.decompress(buf), 'gzip'))
        except Exception:
            pass
    if buf[:1] == b'\x78':
        try:
            cands.insert(0, (zlib.decompress(buf), 'zlib'))
        except Exception:
            pass
    return cands


def score_player_info(buf):
    """给一个候选数据打分: 越像 PlayerInfo 分越高; 不可能返回 -1。"""
    try:
        score = 0
        for fno, wire, val in iter_fields(buf):
            if fno == 1 and wire == 2:
                score += 2
            elif fno == 2 and wire == 2:
                score += 2
            elif fno == 3 and wire == 2:
                score += 2
            elif fno in (4, 5) and wire == 2:
                score += 1
            else:
                score += 0
    except Exception:
        return -1
    return score


def json_result(data):
    """JSON 输入统一处理: 识别 LeanCloud .userdata 并自动脱敏。"""
    if isinstance(data, dict) and (
            data.get('className') == '_User'
            or 'authData' in data or 'sessionToken' in data):
        taptap = None
        ad = data.get('authData')
        if isinstance(ad, dict):
            taptap = ad.get('taptap')
        return {
            '_format': 'LeanCloud _User 账号会话文件 (.userdata) —— 不是游戏存档',
            '_warning': '该文件包含账号凭证(access_token / mac_key / sessionToken 等)，'
                        '属极高敏感信息，切勿分享或上传网络！'
                        '游戏成绩数据请用 player0.save 或存档同步码解析。',
            'nickname': data.get('nickname'),
            'shortId': data.get('shortId'),
            'objectId': data.get('objectId'),
            'createdAt': data.get('createdAt'),
            'updatedAt': data.get('updatedAt'),
            'taptap_linked': bool(taptap),
            '_redacted': [k for k in ('authData', 'sessionToken', 'ACL', 'username',
                                      'email', 'mobilePhoneNumber', 'avatar')
                          if k in data],
        }
    return {'_format': 'json (文本存档)', 'data': data}


B64_CHARS = set(b'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=')


def maybe_base64_text(buf):
    """若 buf 是纯 base64 文本(如游戏内分享/云同步的存档码), 返回解码字节, 否则 None。"""
    if len(buf) < 16 or len(buf) > 8 * 1024 * 1024:
        return None
    s = bytes(c for c in buf if c not in b'\r\n \t')
    if not s or len(s) % 4 != 0:
        return None
    for c in s:
        if c not in B64_CHARS:
            return None
    try:
        return base64.b64decode(s)
    except Exception:
        return None


def parse_auto(buf):
    """自动识别并解析存档字节。"""
    stripped = buf.strip()
    if stripped[:1] in (b'{', b'['):
        try:
            data = json.loads(stripped.decode('utf-8'))
            return json_result(data)
        except Exception:
            pass
    dec = maybe_base64_text(buf)
    if dec is not None and len(dec) >= 2 and score_player_info(dec) > 0:
        parsed = parse_player_info(dec)
        parsed['_container'] = 'base64 (存档同步码)'
        return parsed
    best = None
    for data, kind in unwrap(buf):
        sc = score_player_info(data)
        if sc < 0:
            continue
        try:
            parsed = parse_player_info(data)
        except Exception:
            continue
        parsed['_container'] = kind
        if best is None or sc > best[0]:
            best = (sc, parsed)
    if best is None:
        raise ValueError(
            '无法识别为 PlayerInfo 存档。\n'
            '前 64 字节: ' + buf[:64].hex())
    return best[1]


# ---------------------------------------------------------------- 摘要 --


def summarize(info):
    lines = []
    add = lines.append
    add('=' * 58)
    add('  Simple 存档摘要  (%s)' % info.get('_format', '?'))
    add('=' * 58)
    add('玩家名   : %s' % (info.get('playerName') or '(空)'))
    add('UnionId  : %s' % (info.get('unionId') or '(空)'))
    add('设备信息 : %s' % (info.get('deviceInfo') or '(空)'))
    scores = info.get('scores', [])
    add('成绩条目 : %d' % len(scores))
    uz = info.get('unlockedStatus', {})
    add('解锁条目 : %d' % len(uz))
    add('')
    if scores:
        add('---- 成绩 (按 perfect 降序, 前 20) ----')
        for s in sorted(scores, key=lambda x: -x.get('perfect', 0))[:20]:
            add('  %-28s [%s / %s]  P%-5d G%d/%d B%d/%d M%-4d FC%-4d MAX%-5d' % (
                s.get('musicName', '?'),
                s.get('chapterName', '?'),
                s.get('hardName', '?'),
                s.get('perfect', 0),
                s.get('earlyGood', 0), s.get('lateGood', 0),
                s.get('earlyBad', 0), s.get('lateBad', 0),
                s.get('miss', 0),
                s.get('fullComboCount', 0),
                s.get('maxComboCount', 0)))
    if uz:
        add('')
        add('---- 解锁状态 (前 40) ----')
        for i, (k, v) in enumerate(sorted(uz.items())):
            if i >= 40:
                add('  ... 共 %d 项' % len(uz))
                break
            add('  %-32s %s' % (k, v))
    return '\n'.join(lines)


# ---------------------------------------------------------------- CLI --


def main(argv):
    if len(argv) < 2 or argv[1] in ('-h', '--help'):
        sys.stderr.write(__doc__ + '\n')
        return 2

    args = argv[1:]
    path = None
    hexstr = None
    b64str = None
    out_path = None
    raw_mode = False
    summary = False
    music_cfg = None

    i = 0
    while i < len(args):
        a = args[i]
        if a == '--hex':
            i += 1
            hexstr = args[i]
        elif a in ('--base64', '--b64'):
            i += 1
            b64str = args[i]
        elif a in ('-o', '--output'):
            i += 1
            out_path = args[i]
        elif a == '--raw':
            raw_mode = True
        elif a == '--summary':
            summary = True
        elif a == '--music':
            i += 1
            music_cfg = args[i]
        elif a.startswith('--'):
            sys.stderr.write('未知参数: %s\n' % a)
            return 2
        else:
            path = a
        i += 1

    if hexstr:
        buf = bytes.fromhex(hexstr.replace(' ', '').replace('\n', ''))
    elif b64str:
        buf = base64.b64decode(bytes(c for c in b64str.encode()
                                     if c not in b'\r\n \t'))
    elif path in (None, '-'):
        buf = sys.stdin.buffer.read()
    else:
        with open(path, 'rb') as f:
            buf = f.read()

    try:
        if raw_mode:
            result = dump_raw(buf)
        else:
            result = parse_auto(buf)
    except Exception as exc:
        sys.stderr.write('解析失败: %s\n' % exc)
        return 1

    if music_cfg and not raw_mode:
        try:
            attach_music_titles(result, music_cfg)
        except Exception as exc:
            sys.stderr.write('加载曲目表失败: %s\n' % exc)

    if summary and not raw_mode:
        text = summarize(result)
    else:
        text = json.dumps(result, ensure_ascii=False, indent=2)

    if out_path:
        with open(out_path, 'w', encoding='utf-8') as f:
            f.write(text)
        sys.stderr.write('已写入 %s\n' % out_path)
    else:
        print(text)
    return 0


def attach_music_titles(info, cfg_path):
    """可选: 读取 Config_Music 文本(CSV), 为成绩补充曲名/作曲。"""
    titles = {}
    with open(cfg_path, 'r', encoding='utf-8', errors='replace') as f:
        header = f.readline().strip().lstrip('\ufeff').split(',')
        idx = {name: n for n, name in enumerate(header)}
        for line in f:
            parts = line.rstrip('\r\n').split(',')
            if len(parts) < 2:
                continue
            key = parts[idx.get('MusicName', 0)]
            titles[key] = {
                'title': parts[idx.get('Title', 1)] if 'Title' in idx and len(parts) > idx['Title'] else '',
                'composer': parts[idx.get('Composer', 2)] if 'Composer' in idx and len(parts) > idx['Composer'] else '',
            }
    if 'scores' in info:
        for s in info['scores']:
            t = titles.get(s.get('musicName'))
            if t:
                s['title'] = t['title']
                s['composer'] = t['composer']


if __name__ == '__main__':
    sys.exit(main(sys.argv))
