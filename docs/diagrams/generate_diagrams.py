from __future__ import annotations

import math
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parent
WIDTH, HEIGHT = 1920, 1080

FONT_REGULAR = Path(r"C:\Windows\Fonts\segoeui.ttf")
FONT_BOLD = Path(r"C:\Windows\Fonts\segoeuib.ttf")


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(str(FONT_BOLD if bold else FONT_REGULAR), size=size)


def text_size(draw: ImageDraw.ImageDraw, text: str, fnt: ImageFont.FreeTypeFont) -> tuple[int, int]:
    bbox = draw.textbbox((0, 0), text, font=fnt)
    return bbox[2] - bbox[0], bbox[3] - bbox[1]


def wrap_line(draw: ImageDraw.ImageDraw, line: str, fnt: ImageFont.FreeTypeFont, max_width: int) -> list[str]:
    words = line.split()
    if not words:
        return [""]

    lines: list[str] = []
    current = words[0]
    for word in words[1:]:
        candidate = f"{current} {word}"
        if text_size(draw, candidate, fnt)[0] <= max_width:
            current = candidate
        else:
            lines.append(current)
            current = word
    lines.append(current)
    return lines


def draw_centered_text(
    draw: ImageDraw.ImageDraw,
    box: tuple[int, int, int, int],
    text: str,
    size: int,
    color: str = "#0F172A",
    bold: bool = False,
    spacing: int = 8,
) -> None:
    x, y, w, h = box
    fnt = font(size, bold)
    lines: list[str] = []
    for raw_line in text.splitlines():
        lines.extend(wrap_line(draw, raw_line, fnt, w))

    line_height = size + spacing
    total_height = line_height * len(lines) - spacing
    start_y = y + (h - total_height) / 2
    for index, line in enumerate(lines):
        line_w, line_h = text_size(draw, line, fnt)
        draw.text((x + (w - line_w) / 2, start_y + index * line_height), line, fill=color, font=fnt)


def rounded_box(
    draw: ImageDraw.ImageDraw,
    xywh: tuple[int, int, int, int],
    title: str,
    body: str,
    fill: str,
    outline: str,
) -> None:
    x, y, w, h = xywh
    draw.rounded_rectangle((x, y, x + w, y + h), radius=18, fill=fill, outline=outline, width=3)
    draw_centered_text(draw, (x + 24, y + 14, w - 48, 36), title, 24, bold=True)
    draw_centered_text(draw, (x + 26, y + 54, w - 52, h - 64), body, 19, color="#334155")


def decision(draw: ImageDraw.ImageDraw, center: tuple[int, int], size: tuple[int, int], text: str) -> None:
    cx, cy = center
    w, h = size
    points = [(cx, cy - h // 2), (cx + w // 2, cy), (cx, cy + h // 2), (cx - w // 2, cy)]
    draw.polygon(points, fill="#FFF7ED", outline="#F97316")
    draw.line(points + [points[0]], fill="#F97316", width=4)
    draw_centered_text(draw, (cx - w // 2 + 44, cy - h // 2 + 20, w - 88, h - 40), text, 20, "#7C2D12", True)


def arrow(
    draw: ImageDraw.ImageDraw,
    start: tuple[int, int],
    end: tuple[int, int],
    label: str = "",
    color: str = "#475569",
) -> None:
    draw.line((start, end), fill=color, width=4)
    angle = math.atan2(end[1] - start[1], end[0] - start[0])
    head_len = 18
    spread = math.pi / 7
    p1 = (
        end[0] - head_len * math.cos(angle - spread),
        end[1] - head_len * math.sin(angle - spread),
    )
    p2 = (
        end[0] - head_len * math.cos(angle + spread),
        end[1] - head_len * math.sin(angle + spread),
    )
    draw.polygon([end, p1, p2], fill=color)

    if label:
        mid = ((start[0] + end[0]) // 2, (start[1] + end[1]) // 2)
        fnt = font(17)
        tw, th = text_size(draw, label, fnt)
        pad_x, pad_y = 12, 6
        rect = (
            mid[0] - tw // 2 - pad_x,
            mid[1] - th // 2 - pad_y,
            mid[0] + tw // 2 + pad_x,
            mid[1] + th // 2 + pad_y,
        )
        draw.rounded_rectangle(rect, radius=8, fill="#F8FAFC", outline="#E2E8F0")
        draw.text((mid[0] - tw / 2, mid[1] - th / 2 - 1), label, fill="#334155", font=fnt)


def base_canvas(title: str, subtitle: str, lanes: list[tuple[int, str, str]]) -> tuple[Image.Image, ImageDraw.ImageDraw]:
    image = Image.new("RGB", (WIDTH, HEIGHT), "#F8FAFC")
    draw = ImageDraw.Draw(image)
    for x in range(80, 1840, 80):
        draw.line((x, 150, x, 1010), fill="#E2E8F0", width=1)
    for y in range(180, 1020, 80):
        draw.line((70, y, 1850, y), fill="#E2E8F0", width=1)

    draw_centered_text(draw, (80, 38, 1760, 62), title, 42, bold=True)
    draw_centered_text(draw, (140, 104, 1640, 40), subtitle, 23, "#475569")
    for x, lane, color in lanes:
        draw_centered_text(draw, (x, 160, 340, 36), lane, 22, color, True)
    return image, draw


def make_light_diagram() -> None:
    image, draw = base_canvas(
        "LUỒNG HOẠT ĐỘNG CỦA ĐÈN",
        "Điều khiển thủ công, hẹn giờ và cảm biến ánh sáng qua Backend + MQTT",
        [
            (120, "APP NGƯỜI DÙNG", "#2563EB"),
            (530, "BACKEND / DATABASE", "#16A34A"),
            (970, "MQTT BROKER", "#7C3AED"),
            (1385, "ESP32 + ĐÈN", "#DC2626"),
        ],
    )

    rounded_box(draw, (95, 230, 360, 135), "App", "Bật/tắt đèn\nCài hẹn giờ\nBật/tắt cảm biến ánh sáng", "#DBEAFE", "#2563EB")
    rounded_box(draw, (520, 230, 385, 135), "Backend API", "/lights/OnOff\n/lights/Timer\n/lights/SensorMode", "#DCFCE7", "#16A34A")
    rounded_box(draw, (1010, 230, 330, 135), "MQTT Control", "lights/01/server\n{type: 0/1}\nlights/01/sensorControl", "#F3E8FF", "#7C3AED")
    rounded_box(draw, (1460, 230, 345, 135), "ESP32", "Nhận lệnh\nĐiều khiển relay đèn\nBật/tắt chế độ sensor", "#FEE2E2", "#DC2626")

    arrow(draw, (455, 298), (520, 298), "HTTP")
    arrow(draw, (905, 298), (1010, 298), "Publish")
    arrow(draw, (1340, 298), (1460, 298), "Subscribe")

    rounded_box(draw, (520, 430, 385, 130), "Lưu Database", "status\ntimerEnabled, autoOnTime\nmanualOverride, lastAutoReason", "#ECFDF5", "#16A34A")
    arrow(draw, (712, 365), (712, 430), "update")

    rounded_box(draw, (1460, 440, 345, 125), "Phản hồi trạng thái", "Đèn đổi trạng thái thật\nSensor chỉ được sync\nkhi lightSensorEnabled=true", "#FFF1F2", "#E11D48")
    rounded_box(draw, (1010, 440, 330, 125), "MQTT Response", "lights/01/button\n{status/type: 0/1}\nlights/01/sensor", "#FAF5FF", "#7C3AED")
    arrow(draw, (1460, 502), (1340, 502), "Publish")
    arrow(draw, (1010, 502), (905, 502), "Sync DB")

    rounded_box(draw, (520, 640, 385, 130), "Timer định kỳ", "Backend kiểm tra mỗi chu kỳ\nNếu đến giờ bật/tắt\nthì publish lệnh cho ESP32", "#DCFCE7", "#15803D")
    decision(draw, (1135, 705), (300, 150), "manualOverride\n= true?")
    rounded_box(draw, (1460, 635, 345, 135), "Kết quả timer", "Không bị chặn:\n{type: 0/1}\nlastAutoReason = timer", "#FEE2E2", "#DC2626")
    arrow(draw, (905, 705), (985, 705), "kiểm tra")
    arrow(draw, (1285, 705), (1460, 705), "Không")
    arrow(draw, (1135, 780), (1135, 850), "Có: bỏ qua")

    rounded_box(draw, (95, 815, 360, 120), "App cập nhật UI", "Tự refresh mỗi 30 giây\nHoặc người dùng bấm Refresh", "#E0F2FE", "#0284C7")
    rounded_box(draw, (520, 830, 385, 120), "API lấy trạng thái", "App gọi Backend\nBackend trả dữ liệu mới nhất từ DB", "#F0FDF4", "#16A34A")
    arrow(draw, (455, 875), (520, 875), "GET status")

    image.save(ROOT / "luong-hoat-dong-den.png")


def make_fan_diagram() -> None:
    image, draw = base_canvas(
        "LUỒNG HOẠT ĐỘNG CỦA QUẠT",
        "Ưu tiên: Gas danger > manual > timer > auto cooling theo nhiệt độ",
        [
            (120, "APP NGƯỜI DÙNG", "#2563EB"),
            (500, "BACKEND / DATABASE", "#16A34A"),
            (940, "MQTT + SENSOR", "#7C3AED"),
            (1385, "ESP32 + QUẠT", "#DC2626"),
        ],
    )

    rounded_box(draw, (95, 225, 360, 135), "App", "Bật/tắt quạt\nCài hẹn giờ\nCài ngưỡng nhiệt độ", "#DBEAFE", "#2563EB")
    rounded_box(draw, (500, 225, 390, 135), "Backend API", "/fans/OnOff\n/fans/Timer\n/fans/AutoTemperature", "#DCFCE7", "#16A34A")
    rounded_box(draw, (1010, 225, 330, 135), "MQTT Control", "fans/01/server\n{type: 0/1}", "#F3E8FF", "#7C3AED")
    rounded_box(draw, (1460, 225, 345, 135), "ESP32", "Nhận lệnh\nĐiều khiển relay quạt\nPublish phản hồi trạng thái", "#FEE2E2", "#DC2626")
    arrow(draw, (455, 293), (500, 293), "HTTP")
    arrow(draw, (890, 293), (1010, 293), "Publish")
    arrow(draw, (1340, 293), (1460, 293), "Subscribe")

    rounded_box(draw, (500, 420, 390, 135), "Lưu Database", "status, timerEnabled\nautoOnByTemperature\nautoOnTemperature, manualOverride", "#ECFDF5", "#16A34A")
    arrow(draw, (695, 360), (695, 420), "update")
    rounded_box(draw, (1460, 420, 345, 125), "Phản hồi trạng thái", "ESP32 publish kết quả\nsau khi quạt bật/tắt", "#FFF1F2", "#E11D48")
    rounded_box(draw, (1010, 420, 330, 125), "MQTT Response", "fans/01/button\n{status/type: 0/1}", "#FAF5FF", "#7C3AED")
    arrow(draw, (1460, 482), (1340, 482), "Publish")
    arrow(draw, (1010, 482), (890, 482), "Sync DB")

    rounded_box(draw, (95, 615, 360, 125), "ESP32 gửi sensor", "DHT22/Statistics\nNhiệt độ, độ ẩm\nMQ135/Statistics: PPM", "#EEF2FF", "#4F46E5")
    rounded_box(draw, (500, 615, 390, 125), "Backend lưu sensor", "Lưu DHT22 và MQ135\nPPM > 1100: force tắt quạt\nPPM < 900: cho phép auto", "#DCFCE7", "#16A34A")
    arrow(draw, (455, 677), (500, 677), "MQTT")

    decision(draw, (1085, 680), (360, 165), "Nhiệt độ >= ngưỡng\nvà PPM < 900?")
    arrow(draw, (890, 677), (905, 677), "đánh giá")
    decision(draw, (1085, 875), (330, 145), "manualOverride\n= true?")
    rounded_box(draw, (1460, 615, 345, 135), "Tự bật quạt", "Nếu hợp lệ:\nstatus = 1\nlastAutoReason = temperature", "#FEE2E2", "#DC2626")
    rounded_box(draw, (1460, 820, 345, 135), "Tự tắt / bỏ qua", "Gas danger: tắt ngay\nTimer active: sensor không tắt\nManualOverride: không bật", "#FFEDD5", "#EA580C")
    arrow(draw, (1265, 680), (1460, 680), "Có")
    arrow(draw, (1085, 762), (1085, 802), "kiểm tra")
    arrow(draw, (1250, 875), (1460, 875), "Có / sai")
    arrow(draw, (1185, 755), (1460, 875), "Không đạt")

    rounded_box(draw, (95, 840, 360, 120), "App cập nhật UI", "Tự refresh mỗi 30 giây\nHoặc người dùng bấm Refresh", "#E0F2FE", "#0284C7")
    arrow(draw, (455, 900), (500, 900), "GET status")

    image.save(ROOT / "luong-hoat-dong-quat.png")


if __name__ == "__main__":
    make_light_diagram()
    make_fan_diagram()
    print(ROOT / "luong-hoat-dong-den.png")
    print(ROOT / "luong-hoat-dong-quat.png")
