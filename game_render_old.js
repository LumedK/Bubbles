import { Settings, Message, GameObject } from './game_worker.js'

const workerExpect = new Set()

class Images {
    static getImage(src) {
        const image = new Image()
        image.src = src
        return image
    }

    static ball_1 = Images.getImage('img/cat.png')
    static ball_2 = Images.getImage('img/ghost.png')
    static ball_3 = Images.getImage('img/demon.png')
    static ball_4 = Images.getImage('img/pumpkin.png')
    static ball_5 = Images.getImage('img/vampire.png')
    static ball_6 = Images.getImage('img/zombie.png')
}

class Field {
    constructor() {
        this.cursorX = -1
        this.cursorY = -1
        this.clickX = -1
        this.clickY = -1

        this.canvas = document.getElementById('gameField')
        this.ctx = this.canvas.getContext('2d')
        this.canvas.width = Settings.fieldWidth
        this.canvas.height = Settings.fieldHeight
        this.canvas.addEventListener('mousemove', this.mouseEvent.bind(this))
        this.canvas.addEventListener('click', this.clickEvent.bind(this))
    }

    translateCursor(layerX, layerY) {
        return {
            x: (this.canvas.width / this.canvas.offsetWidth) * layerX,
            y: (this.canvas.height / this.canvas.offsetHeight) * layerY
        }
    }

    mouseEvent(event) {
        const cursorXY = this.translateCursor(event.layerX, event.layerY)
        this.cursorX = cursorXY.x
        this.cursorY = cursorXY.y
    }

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

class Render {
    constructor(field, list = []) {
        this.field = field
        this.list = list
        this.interval = setInterval(this.run.bind(this), 1000 / Settings.maxFps)

        this.fps = {
            counter: 0,
            startingSecond: new Date().getSeconds(),
            element: document.getElementById('fps'),
            show() {
                const currentSecond = new Date().getSeconds()
                this.counter++
                if (this.startingSecond !== currentSecond) {
                    this.element.innerHTML = this.counter
                    this.startingSecond = currentSecond
                    this.counter = 0
                }
            }
        }
    }

    run() {
        const field = this.field
        const waitingAnimationComplete = workerExpect.has('animation_complete')
        let isAnimationComplete = true

        field.ctx.clearRect(0, 0, field.canvas.width, field.canvas.height)

        for (let renderObject of this.list) {
            try {
                const objectType = renderObject.type
                const gameObject = GameObject.RenderObject[objectType]
                const image = Images[renderObject.typeName]

                gameObject.render(renderObject, field, image)

                isAnimationComplete =
                    waitingAnimationComplete &&
                    isAnimationComplete &&
                    !Boolean(renderObject?.animation)
            } catch (error) {
                console.log('render error', error)
                continue
            }
        }

        if (waitingAnimationComplete && isAnimationComplete) {
            workerExpect.delete('animation_complete')
            new Message('animation_complete').post()
        }
        this.fps.show()
    }
}

function onmessage(event) {
    const message = event.data
    render.list = message.attachment

    message.actionsList.forEach((action) => {
        workerExpect.add(action)
    })
}

// INITIALIZATION
const field = new Field()
const render = new Render(field)

Message.worker = new Worker('game_worker.js', { type: 'module' })
Message.onmessage = onmessage

// RUN
new Message('start_game').post()
