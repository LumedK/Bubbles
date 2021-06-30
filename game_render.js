import { Settings, Message } from './game_worker.js'

const field = {
    cursorX: -1,
    cursorY: -1,
    clickX: -1,
    clickY: -1,
    canvas: document.getElementById('gameField'),
    ctx: this.canvas.getContext('2d'),

    initiated: (() => {
        this.canvas.width = Settings.fieldWidth
        this.canvas.height = Settings.fieldHeight
        this.canvas.addEventListener('mousemove', this.mouseEvent.bind(this))
        this.canvas.addEventListener('click', this.clickEvent.bind(this))
        return true
    })(),

    translateCursor(layerX, layerY) {
        return {
            x: (this.canvas.width / this.canvas.offsetWidth) * layerX,
            y: (this.canvas.height / this.canvas.offsetHeight) * layerY
        }
    },

    mouseEvent(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.cursorX = cursorXY.x
        this.cursorY = cursorXY.y
    },

    clickEvent(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.clickX = cursorXY.x
        this.clickY = cursorXY.y
        if (workerExpect.has('on_click')) {
            workerExpect.delete('on_click')
            new Message('on_click', cursorXY).post()
        }
    }
}

Message.worker = new Worker('game_worker.js', { type: 'module' })
Message.onmessage = function (event) {}

// Start
new Message('start_new_game').post()
