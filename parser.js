function _check_xml_or_json_type (str) {
    try {
        JSON.parse(str);
        return "json";
    } catch (e) {
        const parser = new DOMParser();
        const xml_obj = parser.parseFromString(str, "text/xml");
        if (xml_obj.documentElement.nodeName === "parsererror") {
            return null;
        }
        return "xml";
    }
}

class Note {
    static get SIDE_LEFT() { return -1; }
    static get SIDE_FRONT() { return 0; }
    static get SIDE_RIGHT() { return 1; }

    static get NOTE_NORMAL() { return 1; }
    static get NOTE_CHAIN() { return 0; }
    static get NOTE_HOLD() { return 2; }

    constructor(position, width = 1.0, side = 0, type = 0, start = 0., end = null) {
        this.position = position + width / 2;
        this.width = width;
        this.side = side;
        this.type = type;
        this.start = start;
        if (end == null) {
            this.end = start;
        } else {
            this.end = Math.max(start, end);
        }
    }
}

function _note_sort (a, b) {
    if (a.type !== b.type) {
        return b.type - a.type;
    }
    return a.start - b.start;
}

class Chart {
    constructor() {
        this.name = "";
        this.map_id = "";
        this.notes = [];
        this.time = 0.;
        this.left_slide = false;
        this.right_slide = false;
        this.bar_per_min = 0.;
        this.time_offset = 0.;
    }
}

function _safe_to_float(value, default_value) {
    if (typeof value === "string") {
        const res = parseFloat(value);
        if (isNaN(res)) {
            return default_value;
        }
        return res;
    } else if (typeof value === "number") {
        return value;
    }
    return default_value;
}

function _safe_to_int(value, default_value) {
    if (typeof value === "string") {
        const res = parseInt(value);
        if (isNaN(res)) {
            return default_value;
        }
        return res;
    } else if (typeof value === "number") {
        return value;
    }
    return default_value;
}

function _xml_safe_find(doc_obj, tag, default_value) {
    const collection = doc_obj.getElementsByTagName(tag);
    if (collection.length < 1) {
        return default_value;
    }
    const item = collection[0];
    if (item.textContent == null) {
        return default_value;
    }
    return item.textContent;
}

function _xml_safe_find_notes(xml_obj, tag) {
    const note_tag = xml_obj.getElementsByTagName(tag);
    if (note_tag.length < 1) {
        return [];
    }
    const notes = note_tag[0].getElementsByTagName("m_notes");
    if (notes.length < 1) {
        return [];
    }
    return notes[0].getElementsByTagName("CMapNoteAsset");
}

function _xml_read_notes(dest, notes, side) {
    var holds = {};
    var subs = {};
    var max_time = 0.0;
    Array.from(notes).forEach((note) => {
        var id = _xml_safe_find(note, "m_id", "");
        var type = _xml_safe_find(note, "m_type", "normal");
        var time = _xml_safe_find(note, "m_time", "");
        var pos = _xml_safe_find(note, "m_position", "");
        var width = _xml_safe_find(note, "m_width", "");
        var sub_id = _xml_safe_find(note, "m_subId", "-1");

        sub_id = _safe_to_int(sub_id, -1);
        time = _safe_to_float(time, 0.0);
        pos = _safe_to_float(pos, 2.5);
        width = _safe_to_float(width, 1.0);

        type = type.toLowerCase();
        if (type === "chain") {
            type = Note.NOTE_CHAIN;
        } else if (type === "hold") {
            type = Note.NOTE_HOLD;
        } else if (type === "sub") {
            subs[id] = time;
            return;
        } else {
            type = Note.NOTE_NORMAL;
        }
        var note_obj = new Note(pos, width, side, type, time);
        if (type === Note.NOTE_HOLD) {
            holds[id] = [note_obj, sub_id];
        }
        dest.push(note_obj);
        max_time = Math.max(max_time, time);
    });
    console.log(subs);
    for (var key in holds) {
        const value = holds[key];
        const note = value[0];
        const sub_id = value[1];
        const sub = subs[sub_id];
        if (sub != null) {
            note.end = sub;
            console.log(note);
        }
    }
    return max_time;
}

function parse_xml(xml_data) {
    const parser = new DOMParser();
    const xml_obj = parser.parseFromString(xml_data, "text/xml");

    var name = _xml_safe_find(xml_obj, "m_path", "");
    var bar_per_min = _xml_safe_find(xml_obj, "m_barPerMin", "");
    var time_offset = _xml_safe_find(xml_obj, "m_timeOffset", "")
    var left_pad = _xml_safe_find(xml_obj, "m_leftRegion", "multi")
    var right_pad = _xml_safe_find(xml_obj, "m_rightRegion", "multi")
    var map_id = _xml_safe_find(xml_obj, "m_mapID", "")

    bar_per_min = _safe_to_float(bar_per_min, 1.);
    time_offset = _safe_to_float(time_offset, 1.);

    var chart = new Chart();
    chart.name = name;
    chart.map_id = map_id;
    chart.bar_per_min = bar_per_min;
    chart.time_offset = time_offset;
    chart.left_slide = left_pad.toLowerCase() === "pad";
    chart.right_slide = right_pad.toLowerCase() === "pad";

    const bottom_notes = _xml_safe_find_notes(xml_obj, "m_notes");
    const left_notes = _xml_safe_find_notes(xml_obj, "m_notesLeft");
    const right_notes = _xml_safe_find_notes(xml_obj, "m_notesRight");

    chart.time = Math.ceil(Math.max(
        _xml_read_notes(chart.notes, bottom_notes, Note.SIDE_FRONT),
        _xml_read_notes(chart.notes, left_notes, Note.SIDE_LEFT),
        _xml_read_notes(chart.notes, right_notes, Note.SIDE_RIGHT)
    ));
    return chart;
}

function _json_safe_get(json_obj, key, default_value) {
    if (json_obj.hasOwnProperty(key)) {
        return json_obj[key];
    }
    return default_value;
}

function _json_safe_find_notes(json_obj, tag) {
    if (!json_obj.hasOwnProperty(tag)) {
        return [];
    }
    const notes = json_obj[tag];
    if (!notes.hasOwnProperty("m_notes")) {
        return [];
    }
    return notes["m_notes"];
}

function _json_read_notes(dest, notes, side) {
    var holds = {};
    var subs = {};
    var max_time = 0.0;
    notes.forEach((note) => {
        var id = _json_safe_get(note, "m_id", "");
        var type = _json_safe_get(note, "m_type", "0");
        var time = _json_safe_get(note, "m_time", "");
        var pos = _json_safe_get(note, "m_position", "");
        var width = _json_safe_get(note, "m_width", "");
        var sub_id = _json_safe_get(note, "m_subId", "-1");

        sub_id = _safe_to_int(sub_id, -1);
        time = _safe_to_float(time, 0.0);
        pos = _safe_to_float(pos, 2.5);
        width = _safe_to_float(width, 1.0);
        type = _safe_to_int(type, 0);

        if (type === 1) {
            type = Note.NOTE_CHAIN;
        } else if (type === 2) {
            type = Note.NOTE_HOLD;
        } else if (type === 3) {
            subs[id] = time;
            return;
        } else {
            type = Note.NOTE_NORMAL;
        }
        var note_obj = new Note(pos, width, side, type, time);
        if (type === Note.NOTE_HOLD) {
            holds[id] = [note_obj, sub_id];
        }
        dest.push(note_obj);
        max_time = Math.max(max_time, time);
    });
    for (var key in holds) {
        const value = holds[key];
        const note = value[0];
        const sub_id = value[1];
        const sub = subs[sub_id];
        if (sub != null) {
            note.end = sub;
        }
    }
    return max_time;
}

function parse_json(json_data) {
    var json_obj = JSON.parse(json_data);

    var name = _json_safe_get(json_obj, "m_Name", "")
    var bar_per_min = _json_safe_get(json_obj, "m_barPerMin", "")
    var time_offset = _json_safe_get(json_obj, "m_timeOffset", "")
    var left_pad = _json_safe_get(json_obj, "m_leftRegion", "")
    var right_pad = _json_safe_get(json_obj, "m_rightRegion", "")
    var map_id = _json_safe_get(json_obj, "m_mapID", "")

    bar_per_min = _safe_to_float(bar_per_min, 1.);
    time_offset = _safe_to_float(time_offset, 0.);
    left_pad = _safe_to_int(left_pad, 2);
    right_pad = _safe_to_int(right_pad, 2);

    var chart = new Chart();
    chart.name = name;
    chart.map_id = map_id;
    chart.bar_per_min = bar_per_min;
    chart.time_offset = time_offset;
    chart.left_slide = left_pad === 1;
    chart.right_slide = right_pad === 1;

    const bottom_notes = _json_safe_find_notes(json_obj, "m_notes");
    const left_notes = _json_safe_find_notes(json_obj, "m_notesLeft");
    const right_notes = _json_safe_find_notes(json_obj, "m_notesRight");

    chart.time = Math.ceil(Math.max(
        _json_read_notes(chart.notes, bottom_notes, Note.SIDE_FRONT),
        _json_read_notes(chart.notes, left_notes, Note.SIDE_LEFT),
        _json_read_notes(chart.notes, right_notes, Note.SIDE_RIGHT)
    ));

    return chart;
}

function parse (str) {
    const type = _check_xml_or_json_type(str);
    if (type === 'json') {
        return parse_json(str);
    } else if (type === "xml") {
        return parse_xml(str);
    }
    return null;
}

class Borders {
    constructor (
        center = 2.5,
        front_border = 2.8,
        front_visible_limit = 3.2,
        side_border = -0.2,
        side_visible_cap = 6.5,
        side_visible_limit = -1.3,
        side_width_ratio = 0.5,
        note_width_bias = 0.1,
        note_width_limit = 0.2
    ) {
        this.center = center;
        this.front_border = front_border;
        this.front_visible_limit = front_visible_limit;
        this.side_border = side_border;
        this.side_visible_cap = side_visible_cap;
        this.side_visible_limit = side_visible_limit;
        this.side_width_ratio = side_width_ratio;
        this.note_width_bias = note_width_bias;
        this.note_width_limit = note_width_limit;
    }

    get left_cap_line () { return 0; }

    get left_cap_line_ratio () { return 0; }

    get left_border_line () {
        return this.side_width_ratio * (this.side_visible_cap - this.side_border);
    }

    get left_border_line_ratio () { return this.left_border_line / this.right_cap_line; }

    get front_left_line () {
        return this.side_width_ratio * (this.side_visible_cap - this.side_visible_limit)
            + (this.front_visible_limit - this.front_border);
    }

    get front_left_line_ratio () { return this.front_left_line / this.right_cap_line; }

    get right_cap_line () {
        return 2 * (
            this.side_width_ratio * (this.side_visible_cap - this.side_visible_limit)
                + this.front_visible_limit
        );
    }

    get width () { return this.right_cap_line; }

    get right_cap_line_ratio () { return 1; }

    get right_border_line () {
        return this.right_cap_line - this.left_border_line;
    }

    get right_border_line_ratio () { return this.right_border_line / this.right_cap_line; }

    get front_right_line () {
        return this.right_cap_line - this.front_left_line;
    }

    get front_right_line_ratio () { return this.front_right_line / this.right_cap_line; }
}

class Printer {
    constructor () {
        this.borders = new Borders();
    }

    notes (chart) {
        var info = []
        console.log(chart);
        chart.notes.forEach((note) => {
            info.push(this.note_position(chart, note));
        });
        return info;
    }

    note_position (chart, note) {
        var x_pos, width = note.width;
        width = Math.max(
            this.borders.note_width_limit,
            width - this.borders.note_width_bias,
            this.borders.note_width_bias - width,
        );
        if (note.side === Note.SIDE_LEFT) {
            x_pos = this.borders.side_width_ratio * (
                this.borders.side_visible_cap - (note.position + note.width / 2));
            width = width * this.borders.side_width_ratio;
        } else if (note.side === Note.SIDE_RIGHT) {
            x_pos = this.borders.width - (this.borders.side_width_ratio * (
                this.borders.side_visible_cap - (note.position - note.width / 2)));
            width = width * this.borders.side_width_ratio;
        } else {
            x_pos = this.borders.width / 2 + (note.position - note.width / 2) - this.borders.center;
        }
        return {
            'type': note.type,
            'x': x_pos / this.borders.width,
            'y': note.start,
            'width': width / this.borders.width,
            'height': note.type === Note.NOTE_HOLD ? note.end - note.start : null
        };
    }
}