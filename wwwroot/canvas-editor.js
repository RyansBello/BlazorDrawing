const canvasManager = {
    canvas: null,
    ctx: null,
    canvas_dr: null,
    ctx_dr: null,
    elements: [],
    selected: null,
    bgImage: null,
    dragging: false,
    dragOffset: { x: 0, y: 0 },
    mode: null, // 'move', 'rotate', 'scale', 'none'
    boxSize: 8,
    rotateHandleDist: 30,
    _settings_dr: {},
    _settings: {},
    _handlers: {},
    isHandDrawing: false,
    drawing: false,

    load: function (canvas, canvas_drID, defaultImageUrl, color = "#ff0000", size = 4) {
        this.canvas = document.getElementById("editor-canvas");
        this.ctx = this.canvas.getContext("2d");
        this.canvas_dr = document.getElementById("drawing-canvas");
        this.ctx_dr = this.canvas_dr.getContext("2d");   
        this._settings[canvas] = { color};
        this._settings_dr[canvas_drID] = { color, size };

        this.elements = [];
        this.selected = null;
        this.loadBackgroundFromUrl(defaultImageUrl);
        this._bindEvents(canvas_drID);
        this._renderLoop();
        this.drawAll();
    },

    _bindEvents: function (canvas_drID) {
        const c = this.canvas;
        const c_dr = this.canvas_dr;
        let self = this;

        const getPos = e => {
            const r = c_dr.getBoundingClientRect();
            const x = (e.touches?.[0]?.clientX ?? e.clientX) - r.left;
            const y = (e.touches?.[0]?.clientY ?? e.clientY) - r.top;
            return {
                x: x * (c_dr.width / r.width),
                y: y * (c_dr.height / r.height)
            };
        };

        const start = e => {
            e.preventDefault();
            self.drawing = true;

            const s = self._settings_dr[canvas_drID];
            self.ctx_dr.strokeStyle = s.color;
            self.ctx_dr.lineWidth = s.size;

            const p = getPos(e);
            self.ctx_dr.beginPath();
            self.ctx_dr.moveTo(p.x, p.y);
        };

        //Saat event mousemove dan drawing = true, ini sudah terhit tetapi gambar garis tidak tampil
        const draw_dr = e => {
            if (!self.drawing) return;
            e.preventDefault();
            const p = getPos(e);
            self.ctx_dr.lineTo(p.x, p.y);
            self.ctx_dr.stroke();
            console.info(`Posisi Gambar : ${p.x} dan ${p.y}`);
        };

        const stop = () => {
            if (!self.drawing) return;
            self.drawing = false;
            self.ctx_dr.closePath();
        };

        c.addEventListener("mousedown", function (e) {
            const rect = c.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (self.isHandDrawing) {
                start(e);
                console.info("Mulai menggambar");
            }
            else {
                if (self.selected) {
                    // Check if click on rotate handle
                    if (self._isOnRotateHandle(self.selected, x, y)) {
                        self.mode = 'rotate';
                        self.dragging = true;
                        self.startAngle = Math.atan2(y - self.selected.y, x - self.selected.x);
                        self.startRotation = self.selected.rotation;
                        return;
                    }
                    // Check if click on scale handle
                    if (self._isOnScaleHandle(self.selected, x, y)) {
                        self.mode = 'scale';
                        self.dragging = true;
                        self.startDist = Math.hypot(x - self.selected.x, y - self.selected.y);
                        self.startScale = self.selected.scale;
                        return;
                    }
                    // Check if click on delete button
                    if (self._isOnDeleteButton(self.selected, x, y)) {
                        self.mode = 'delete';
                        self._deleteSelected();
                        return;
                    }

                    if (self.selected.contains(x, y)) {
                        self.mode = 'move';
                        self.dragging = true;
                        self.dragOffset.x = x - self.selected.x;
                        self.dragOffset.y = y - self.selected.y;
                        return;
                    };
                }

                // If click on any element select it
                let found = null;

                for (let i = self.elements.length - 1; i >= 0; i--) {
                    if (self.elements[i]?.contains(x, y)) {
                        found = self.elements[i];
                        break;
                    }
                }
                self.selected = found;
            }            
        });

        c.addEventListener("mousemove", function (e) {
            const rect = c.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            if (self.isHandDrawing) {
                draw_dr(e);
            }
            else {
                if (!self.dragging) return;

                if (self.mode === 'move') {
                    self.selected.x = x - self.dragOffset.x;
                    self.selected.y = y - self.dragOffset.y;
                }
                else if (self.mode === 'rotate') {
                    let currentAngle = Math.atan2(y - self.selected.y, x - self.selected.x);
                    let delta = currentAngle - self.startAngle;
                    self.selected.rotation = self.startRotation + delta;
                }
                else if (self.mode === 'scale') {
                    let currentDist = Math.hypot(x - self.selected.x, y - self.selected.y);
                    let ratio = currentDist / self.startDist;
                    self.selected.scale = Math.max(0.1, self.startScale * ratio);
                }

                //// Hitung area elemen yang akan dihapus
                //const padding = 5;
                //const width = self.selected.getWidth() * self.selected.scale + padding * 2;
                //const height = self.selected.getHeight() * self.selected.scale + padding * 2;

                //self.ctx.clearRect(
                //    self.selected.x - width / 2,
                //    self.selected.y - height / 2,
                //    width,
                //    height
                //);

                //// Gambar ulang elemen
                //self.selected.draw(self.ctx, true);
            }            
        });

        c.addEventListener("mouseup", function (e) {
            if (self.isHandDrawing) {
                stop();
                console.info("Selesai menggambar");
            }
            else {
                self.dragging = false;
                self.mode = null;
            }
        });

        c.addEventListener("contextmenu", e => e.preventDefault());
    },

    _renderLoop: function () {
        window.requestAnimationFrame(() => {
            try {
                let selectedEvs = this.isHandDrawing ? null : this.selected;

                if (this.bgImage) {
                    this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
                }

                this.elements.forEach(el => el?.draw(this.ctx, el === selectedEvs));             

                if (this.isHandDrawing && this.drawing) {
                    this.ctx_dr.stroke();
                }

                this._renderLoop();

            } catch (e) {
                console.log("Terjadi error:", e.message);
            }
        });
    },

    addText: function (text, fillstyle) {
        const el = new TextElement(text, this.canvas.width / 2, this.canvas.height / 2, fillstyle);
        this.elements.push(el);
        this.selected = el;
    },

    _deleteSelected: function () {
        if (this.selected) {
            this.elements = this.elements.filter(el => el !== this.selected);
            this.selected = null;
        }
    },

    deleteSelected: function () {
        this._deleteSelected();
    },

    reset: function () {
        this.elements = [];
        this.selected = null;
        this.ctx.drawImage(this.bgImage, 0, 0, this.canvas.width, this.canvas.height);
        this.ctx_dr.clearRect(0, 0, this.canvas.width, this.canvas.height);
    },

    saveImage: function () {
        const bgCanvas = document.getElementById("editor-canvas");
        const overlayCanvas = document.getElementById("drawing-canvas");
        const ctx = bgCanvas.getContext("2d");

        // Gambar overlay ke atas bgCanvas
        ctx.drawImage(overlayCanvas, 0, 0);

        // Konversi canvas menjadi Blob dan buat link download
        bgCanvas.toBlob(blob => {
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "merged_image.png";
            link.click();
        }, "image/png");

        this.reset();
    },

    loadBackgroundFromInput: function () {
        const canvas = /** @type {HTMLCanvasElement} */ document.getElementById("editor-canvas");
        const canvas_dr = /** @type {HTMLCanvasElement} */ document.getElementById("drawing-canvas");

        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas_dr.width = rect.width;
        canvas_dr.height = rect.height;

        if (canvas instanceof HTMLCanvasElement && canvas_dr instanceof HTMLCanvasElement) {
            const ctx = canvas.getContext("2d");

            const input = document.querySelector('input[type="file"]');
            if (input && input.files && input.files[0]) {
                const file = input.files[0];
                const reader = new FileReader();
                reader.onload = (evt) => {
                    const img = new Image();
                    img.onload = () => {

                        this.bgImage = img;

                        canvas.width = img.width;
                        canvas.height = img.height;
                        canvas_dr.width = img.width;
                        canvas_dr.height = img.height;

                        canvas_dr.style.left = `${rect.left}px`;
                        canvas_dr.style.top = `${rect.top}px`;

                        ctx.drawImage(img, 0, 0);
                    };
                    img.src = evt.target.result;
                };
                reader.readAsDataURL(file);
                input.value = ""; // clear after load
            }
        }
    },

    loadBackgroundFromUrl: function (imageUrl) {
        const canvas = /** @type {HTMLCanvasElement} */ document.getElementById("editor-canvas");
        const canvas_dr = /** @type {HTMLCanvasElement} */ document.getElementById("drawing-canvas");

        const rect = canvas.getBoundingClientRect();

        canvas.width = rect.width;
        canvas.height = rect.height;
        canvas_dr.width = rect.width;
        canvas_dr.height = rect.height;

        if (canvas instanceof HTMLCanvasElement && canvas_dr instanceof HTMLCanvasElement) {
            const ctx = canvas.getContext("2d");
            const img = new Image();

            img.onload = () => {
                this.bgImage = img;

                canvas.width = img.width;
                canvas.height = img.height;
                canvas_dr.width = img.width;
                canvas_dr.height = img.height;

                canvas_dr.style.left = `${rect.left}px`;
                canvas_dr.style.top = `${rect.top}px`;

                ctx.drawImage(img, 0, 0);
            };

            img.src = imageUrl;
        }
    },

    _isOnRotateHandle: function (el, px, py) {
        const handle = this._getRotateHandlePos(el);
        return this._pointInCircle(px, py, handle.x, handle.y, this.boxSize);
    },

    _isOnScaleHandle: function (el, px, py) {
        const handle = this._getScaleHandlePos(el);
        return this._pointInCircle(px, py, handle.x, handle.y, this.boxSize);
    },

    _isOnDeleteButton: function (el, px, py) {
        const handle = this._getDeleteButtonPos(el);
        return this._pointInRect(px, py, handle.x, handle.y, this.boxSize * 2, this.boxSize * 2);
    },

    _getRotateHandlePos: function (el) {
        // Rotate handle above element center, offset by rotateHandleDist
        let angle = el.rotation;
        return {
            x: el.x + Math.cos(angle - Math.PI / 2) * this.rotateHandleDist * el.scale,
            y: el.y + Math.sin(angle - Math.PI / 2) * this.rotateHandleDist * el.scale
        };
    },

    _getScaleHandlePos: function (el) {
        // Bottom-right corner of bounding box
        let width = 0;
        let height = 0;
        let angle = 0;
        let cx = 0;
        let cy = 0;

        width = el.getWidth() * el.scale;
        height = el.getHeight() * el.scale;
        angle = el.rotation;
        cx = el.x;
        cy = el.y;

        // Calculate corner pos rotated around center

        const localX = width;
        const localY = height / 2;

        const rotatedX = cx + localX * Math.cos(angle) - localY * Math.sin(angle);
        const rotatedY = cy + localX * Math.sin(angle) + localY * Math.cos(angle);

        return { x: rotatedX, y: rotatedY };
    },

    _getDeleteButtonPos: function (el) {
        // Top-left corner of bounding box minus some margin
        let width = 0;
        let height = 0;
        let angle = 0;

        let cx = 0;
        let cy = 0;

        width = el.getWidth() * el.scale;
        height = el.getHeight() * el.scale;
        angle = el.rotation;
        cx = el.x;
        cy = el.y;

        const localX = -width;
        const localY = -height / 2;

        const rotatedX = cx + localX * Math.cos(angle) - localY * Math.sin(angle) - this.boxSize;
        const rotatedY = cy + localX * Math.sin(angle) + localY * Math.cos(angle) - this.boxSize;

        return { x: rotatedX, y: rotatedY };
    },

    _pointInCircle: function (px, py, cx, cy, r) {
        const dx = px - cx;
        const dy = py - cy;
        return dx * dx + dy * dy <= r * r;
    },

    _pointInRect: function (px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    },

    drawAll: function () {
        const ctx = this.ctx;
        const canvas = this.canvas;

        /*ctx.clearRect(0, 0, canvas.width, canvas.height);*/

        if (this.bgImage) {
            ctx.drawImage(this.bgImage, 0, 0);
        }

        for (const el of this.elements) {
            el.draw(ctx, el === this.selected);
        }
    },

    updateBrush: function (canvasId, canvasId_dr, color, size) {
        this._settings[canvasId].color = color;
        this._settings_dr[canvasId_dr].color = color;
        this._settings_dr[canvasId_dr].size = size;
    },

    changeMode: function (mode) {
        this.isHandDrawing = mode;
    },

    triggerFileUpload: function () {
        /** @type {HTMLInputElement} */ document.getElementById("fileInput").click();
    }
}   

// Define element class
class TextElement {
    constructor(text, x, y, fillStyle) {
        this.text = text;
        this.x = x;
        this.y = y;
        this.rotation = 0;
        this.scale = 1;
        this.fontSize = 30;
        this.fontFamily = "Arial";
        this.padding = 10;
        this.fillStyle = fillStyle;
    }

    draw(ctx, selected) {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.rotation);
        ctx.scale(this.scale, this.scale);

        ctx.font = `bold ${this.fontSize}px ${this.fontFamily}`;
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";

        const textWidth = ctx.measureText(this.text).width;
        const boxWidth = textWidth + this.padding * 2;
        const boxHeight = this.fontSize + this.padding * 2;

        // Draw background box
        ctx.fillStyle = "transparent"; // optional: background
        ctx.fillRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);

        // Draw text
        ctx.fillStyle = this.fillStyle;
        ctx.fillText(this.text, 0, 0);

        // Draw selection box
        if (selected) {
            ctx.strokeStyle = "blue";
            ctx.lineWidth = 1;
            ctx.strokeRect(-boxWidth / 2, -boxHeight / 2, boxWidth, boxHeight);
        }

        ctx.restore();

        // Draw handles in global coords
        if (selected) {
            const points = canvasManager;

            const rotateHandle = points._getRotateHandlePos(this);
            const scaleHandle = points._getScaleHandlePos(this);
            const deleteButton = points._getDeleteButtonPos(this);

            ctx.save();
            ctx.fillStyle = "red";

            ctx.beginPath();
            ctx.arc(rotateHandle.x, rotateHandle.y, points.boxSize, 0, 2 * Math.PI);
            ctx.fill();

            ctx.beginPath();
            ctx.arc(scaleHandle.x, scaleHandle.y, points.boxSize, 0, 2 * Math.PI);
            ctx.fill();

            // Delete button square
            ctx.fillRect(deleteButton.x, deleteButton.y, points.boxSize * 2, points.boxSize * 2);
            ctx.strokeStyle = "white";
            ctx.lineWidth = 2;

            ctx.beginPath();
            ctx.moveTo(deleteButton.x + 4, deleteButton.y + 4);
            ctx.lineTo(deleteButton.x + points.boxSize * 2 - 4, deleteButton.y + points.boxSize * 2 - 4);
            ctx.moveTo(deleteButton.x + points.boxSize * 2 - 4, deleteButton.y + 4);
            ctx.lineTo(deleteButton.x + 4, deleteButton.y + points.boxSize * 2 - 4);
            ctx.stroke();

            ctx.restore();
        }
    }

    getWidth() {
        const ctx = canvasManager.ctx;
        ctx.font = `${this.fontSize}px ${this.fontFamily}`;
        const textWidth = ctx.measureText(this.text).width;
        return textWidth / 2 + this.padding; // separuh karena center-x
    }

    getHeight() {
        return this.fontSize * 2;
    }

    contains(px, py) {
        // Check if px,py inside rotated and scaled bounding box
        // Transform px, py into element local coords
        const dx = px - this.x;
        const dy = py - this.y;
        const cos = Math.cos(-this.rotation);
        const sin = Math.sin(-this.rotation);
        const localX = dx * cos - dy * sin;
        const localY = dx * sin + dy * cos;

        const width = this.getWidth() * this.scale;
        const height = this.getHeight() * this.scale;

        return localX >= -width && localX <= width && localY >= -height / 2 && localY <= height / 2;
    }
}

window.canvasManager = canvasManager;
