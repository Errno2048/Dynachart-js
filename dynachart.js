var default_borders = new Borders();
var bar_interval = 1.;
var row_interval = 1 / 16;
var container_width = 864;
var container_bar_height = 480;

function get_bar_container () {
    const chart_container = document.getElementById("chart-container");
    if (chart_container == null) {
        return null;
    }
    return chart_container.getElementsByClassName("bar-container")[0];
}

function get_note_container () {
    const chart_container = document.getElementById("chart-container");
    if (chart_container == null) {
        return null;
    }
    return chart_container.getElementsByClassName("note-container")[0];
}

function clear_chart () {
    const chart_container = document.getElementById("chart-container");
    if (chart_container == null) return;
    chart_container.replaceChildren();

    let chart = document.createElement("div");
    chart_container.appendChild(chart);
    chart.setAttribute("class", "chart");

    let bar_container = document.createElement("div");
    chart.appendChild(bar_container);
    bar_container.setAttribute("class", "bar-container");

    let note_container = document.createElement("div");
    chart.appendChild(note_container);
    note_container.setAttribute("class", "note-container");
}

function draw_bars (printer, max_time, bar_interval = 1., row_interval = 1 / 16) {
    const bar_container = get_bar_container();
    if (bar_container == null) return max_time;

    const bar_number = Math.ceil(max_time / bar_interval);
    const total_time = bar_interval * bar_number;
    const bar_size = 100 / bar_number;
    const row_number = Math.floor(total_time / row_interval);
    const bar_row_ratio = bar_interval / row_interval;
    const row_size = bar_size / bar_row_ratio;

    for (let i = 0; i < row_number; ++i) {
        if (Math.abs(i - Math.round(i / bar_row_ratio) * bar_row_ratio) < 1e-4)
            continue;

        const new_element = document.createElement("row-line");
        bar_container.appendChild(new_element);
        new_element.style.bottom = (i * row_size) + "%";
    }

    for (let i = 0; i < bar_number; ++i) {
        const new_element = document.createElement("bar-line");
        bar_container.appendChild(new_element);
        new_element.style.bottom = (i * bar_size) + "%";
    }

    [
        printer.borders.left_border_line_ratio,
        printer.borders.front_left_line_ratio,
        printer.borders.front_right_line_ratio,
        printer.borders.right_border_line_ratio
    ].forEach((value) => {
        const new_element = document.createElement("column-line");
        bar_container.appendChild(new_element);
        new_element.style.left = 100 * value + "%";
    });

    return total_time;
}

function draw_notes (total_time, notes) {
    const note_container = get_note_container();
    if (note_container == null) return;

    notes.forEach((note) => {
        const new_element = document.createElement("note");
        note_container.appendChild(new_element);
        new_element.setAttribute("type", note.type);
        new_element.style.left = 100 * note.x + "%";
        new_element.style.bottom = 100 * note.y / total_time + "%";
        new_element.style.width = note.type === Note.NOTE_HOLD ?
            "calc(" + (100 * note.width) + "% - 8px)" :
            (100 * note.width) + "%";
        if (note.height != null) {
            new_element.style.height = (100 * Math.max(note.height, row_interval / 4) / total_time) + "%";
        }
    });
}

function load_chart (chart) {
    const chart_container = document.getElementById("chart-container");
    if (chart_container == null) return;

    clear_chart();

    let printer = new Printer();
    printer.borders = default_borders;
    let notes = printer.notes(chart);

    total_time = draw_bars(printer, chart.time, bar_interval, row_interval);
    draw_notes(total_time, notes);

    let height = total_time * container_bar_height;

    chart_container.style.width = container_width + "px";
    chart_container.style.height = height + "px";
}
