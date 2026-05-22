#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import sys
import pathlib
import html as _html
import random
import re

def esc(s: str) -> str:
    return _html.escape(str(s), quote=False).replace('"', "&quot;")

def esc_text(s: str) -> str:
    return _html.escape(str(s), quote=False)

def pick(d: dict, key: str, default="") -> str:
    v = d.get(key, default)
    return "" if v is None else str(v)

def ensure_id(s: str) -> str:
    return s if s and str(s).isdigit() else str(random.randint(10_000_000, 99_999_999))

def safe_filename_from_singer(singer: str) -> str:
    base = (singer or "output")[:6]
    base = re.sub(r'[\\/:*?"<>|]', '_', base)
    base = re.sub(r'\s+', '_', base)
    base = base.strip('_')
    return (base or "output") + ".html"

# 可选的「更多艺人」块（仅 isWrap=true 时插入）
WRAP_ATIST_TMPL = """<div class="wrap_atist" style="">
<button type="button" title="아티스트 더보기 - 레이어 팝업" class="btn btn_more" data-control="dropdown"><span class="odd_span">아티스트명 더보기</span></button>
<div class="l_popup small" style="display:none; width:168px;">
    <div class="l_cntt">
        <ul class="list_bullet">
            <li><a href="#" onclick="goArtist('{artist_id}');" title="{singer}">{singer}</a></li>
        </ul>
    </div>
    <button type="button" class="btn_close"><span class="odd_span">닫기</span></button>
    <span class="shadow"></span>
    <span class="bullet_vertical"></span>
</div>
</div>
"""

# 行模板：通过 {wrap_atist_block} 占位插入或留空
ROW_TMPL = """<tr>
<td><div class="wrap pd_none left">
<input type="checkbox" name="input_check" title="{song_title_attr} 곡 선택" class="input_check" value="{song_id}" data-sclascode="MP3">
</div></td>
<td class="no"><div class="wrap">{index}</div></td>
<td class="t_left"><div class="wrap">
<div class="ellipsis" style="max-width:100%">
<button type="button" class="btn_icon play" title="재생 - 새 창" onclick="MELON.WEBSVC.POC.play.playSong('{play_coll_id}','{song_id}');"><span class="odd_span">재생</span></button>
<button type="button" class="btn_icon add" title="담기 - 새 창" onclick="MELON.WEBSVC.POC.play.addPlayList('{song_id}');"><span class="odd_span">담기</span></button>
<a href="#" onclick="MELON.WEBSVC.POC.link.goSongDetail('{song_id}');" title="곡정보 보기- 페이지 이동" class="btn btn_icon_detail"><span class="odd_span">곡정보</span></a>
<a href="#" onclick="MELON.WEBSVC.POC.play.playSong('{play_coll_id}','{song_id}');" title="{song_title_attr}">{song_title_text}</a>
</div>
</div></td>

<td class="t_left"><div class="wrap">
<div class="ellipsis" style="max-width:122px">
<a href="javascript:goArtist('{artist_id}')" title="{singer_attr}">{singer_text}</a>
<span class="checkEllipsis" style="display: none;"><a href="javascript:goArtist('{artist_id}')" title="{singer_attr}">{singer_text}</a></span>
</div>

{wrap_atist_block}

</div></td>

<td class="t_left"><div class="wrap">
<div class="ellipsis" style="max-width:100%">
<a href="#" onclick="MELON.WEBSVC.POC.link.goAlbumDetail('{album_id}');" title="{album_attr} - 페이지 이동" class="fc_mgray">{album_text}</a>
</div>
</div></td>

<td><div class="wrap pd_none">{format}</div></td>
<td><div class="wrap">{createAt}</div></td>
<td><div class="wrap pd_none right">
<button type="button" class="btn_icon dl" title="{album_attr} 다운로드 - 새 창" onclick="MELON.WEBSVC.POC.buy.goBuyProduct('frm','{song_id}','3C0001','','0','{play_coll_id}')"><span class="odd_span">다운로드</span></button>
</div></td>
</tr>
"""

NAVIG_TMPL = r"""<script type="text/javascript">
$(document).ready(function(){
$('#pageobjNavgation').html("\u003Cdiv class=\"paginate\"\u003E\u003Ca href=\"javascript:;\" class=\"btn_first disabled\"\u003E\u003Cspan\u003E맨처음\u003C\/span\u003E\u003C\/a\u003E \u003Ca href=\"javascript:;\" class=\"btn_pre disabled\"\u003E\u003Cspan\u003E이전\u003C\/span\u003E\u003C\/a\u003E \u003Cspan class=\"page_num\"\u003E\u003Cstrong\u003E\u003Cspan class=\"none\"\u003E현재페이지\u003C\/span\u003E1\u003C\/strong\u003E\u003C\/span\u003E \u003Ca href=\"javascript:;\" class=\"btn_next disabled\"\u003E\u003Cspan\u003E다음\u003C\/span\u003E\u003C\/a\u003E \u003Ca href=\"javascript:;\" class=\"btn_last disabled\"\u003E\u003Cspan\u003E맨끝\u003C\/span\u003E\u003C\/a\u003E\u003C\/div\u003E")
});
</script>
"""

# 这里使用 str.format，只保留 {count} 为占位符，其余 JS 花括号都用 {{ }} 转义
CNT_TMPL = r"""<script type="text/javascript">
$('#cntId').text('{count}');
$(function(){{
  WEBELLIPSIS.ellipsis("checkEllipsis","wrap_atist",122);
}});
</script>
"""

SAFETY_TMPL = r"""<script type="text/javascript">
try {{
  if(typeof pageobj !== 'undefined') {{
    var tempString = '';
    tempString = $.trim(tempString);
    if (tempString === undefined || tempString=== 'undefined' || tempString == '검색어를 입력해 주세요' )
      tempString = "";
    pageobj.addParam("searchString", encodeURIComponent(tempString));
    pageobj.addParam("isCapCnt", 0);
  }} else {{
    // no-op
  }}
}} catch (e) {{}}
</script>
"""

def render_rows(payload: dict) -> str:
    is_wrap = bool(payload.get("isWrap", False))

    singer_raw = pick(payload, "singer", "")
    album_raw = pick(payload, "album", "")
    album_id = ensure_id(pick(payload, "album_id", "11882961"))
    artist_id = ensure_id(pick(payload, "artist_id", "175404"))
    createAt_global_raw = pick(payload, "createAt", "")
    fmt_raw = pick(payload, "format", "MP3")

    songs = payload.get("songs", [])
    if isinstance(songs, dict):
        songs = [songs]
    if isinstance(songs, list) and songs and isinstance(songs[0], str):
        songs = [{"title": s} for s in songs]

    total = len(songs)
    out = []
    for idx, s in enumerate(songs, start=1):
        display_no = total - idx + 1  # 倒序编号

        title_raw = pick(s, "title") or pick(s, "name") or ""
        song_id = ensure_id(pick(s, "song_id", "39264518"))
        play_coll_id = ensure_id(pick(s, "play_coll_id", "31180104"))
        this_album_raw = pick(s, "album", album_raw)
        this_album_id = ensure_id(pick(s, "album_id", album_id))
        this_createAt = esc(pick(s, "createAt", createAt_global_raw or ""))
        this_fmt = esc(pick(s, "format", fmt_raw))

        wrap_block = ""
        if is_wrap:
            wrap_block = WRAP_ATIST_TMPL.format(
                artist_id=artist_id,
                singer=esc(singer_raw),
            )

        out.append(ROW_TMPL.format(
            index=display_no,
            song_title_attr=esc(title_raw),
            song_title_text=esc_text(title_raw),
            song_id=song_id,
            play_coll_id=play_coll_id,
            singer_attr=esc(singer_raw),
            singer_text=esc_text(singer_raw),
            artist_id=artist_id,
            album_attr=esc(this_album_raw),
            album_text=esc_text(this_album_raw),
            album_id=this_album_id,
            format=this_fmt,
            createAt=this_createAt,
            wrap_atist_block=wrap_block
        ))

    rows_html = "\n\n".join(out)
    scripts = NAVIG_TMPL + "\n" + CNT_TMPL.format(count=total) + "\n" + SAFETY_TMPL

    return (
        '<tbody id="pageList">\n    <!--  안쪽 -->\n' +
        rows_html + "\n\n" +
        scripts +
        '\n    <!--eof -->\n    <!-- // 안쪽 -->\n</tbody>\n'
    )

def main():
    if len(sys.argv) < 2:
        print("用法：python3 build_row.py input.json [输出文件.html(可选)]")
        sys.exit(1)

    input_path = pathlib.Path(sys.argv[1])
    if not input_path.exists():
        print(f"找不到输入文件：{input_path}")
        sys.exit(1)

    data = json.loads(input_path.read_text(encoding="utf-8"))

    if len(sys.argv) >= 3:
        output_path = pathlib.Path(sys.argv[2])
    else:
        output_path = pathlib.Path(safe_filename_from_singer(data.get("singer", "output")))

    html_out = render_rows(data)
    output_path.write_text(html_out, encoding="utf-8")
    print(f"✅ 已生成：{output_path.resolve()}")

if __name__ == "__main__":
    main()
