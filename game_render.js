function onWorkerMessage(params) {
    console.log('onWorkerMessage')
}

import { Settings, MainstreamStuff, message } from './game_worker.js'

class Images {
    static getImage(src) {
        const image = new Image()
        image.src = src
        return image
    }
    static aim_arrow = Images.getImage('img/aim_arrow.png')
    // static bubble_1 = Images.getImage('img/cat.png')
    // static bubble_2 = Images.getImage('img/ghost.png')
    // static bubble_3 = Images.getImage('img/demon.png')
    // static bubble_4 = Images.getImage('img/pumpkin.png')
    // static bubble_5 = Images.getImage('img/vampire.png')
    // static bubble_6 = Images.getImage('img/zombie.png')
}

class Field {
    constructor() {
        this.cursorX = Settings.bubbleSpawnX
        this.cursorY = -1
        this.clickX = Settings.bubbleSpawnX
        this.clickY = -1

        this.Images = Images

        this.canvas = document.getElementById('gameField')
        this.ctx = this.canvas.getContext('2d')
        this.canvas.width = Settings.fieldWidth
        this.canvas.height = Settings.fieldHeight
        this.canvas.addEventListener('mousemove', this.onCursorMove.bind(this))
        this.canvas.addEventListener('click', this.onClick.bind(this))
    }

    translateCursor(layerX, layerY) {
        return {
            x: (this.canvas.width / this.canvas.offsetWidth) * layerX,
            y: (this.canvas.height / this.canvas.offsetHeight) * layerY
        }
    }

    onCursorMove(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.cursorX = cursorXY.x
        this.cursorY = cursorXY.y
    }

    onClick(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.clickX = cursorXY.x
        this.clickY = cursorXY.y
        if (MainstreamStuff.currentWorkerMessage === 'waiting_for_click') {
            MainstreamStuff.worker.postMessage(message('click', cursorXY))
        }
    }
}

const gameRender = new MainstreamStuff.Renders.GameRender()
gameRender.field = new Field()
gameRender.interval = setInterval(gameRender.run.bind(gameRender), 1000 / Settings.maxFps)

MainstreamStuff.worker = new Worker('game_worker.js', { type: 'module' })
MainstreamStuff.worker.onmessage = function (event) {
    const { workerMessage, workerData } = event.data
    MainstreamStuff.onWorkerMessage(workerMessage)
    gameRender.renderDataList = workerData.renderDataList
}

MainstreamStuff.worker.postMessage(message('start_new_game'))
