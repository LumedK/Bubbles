import { Settings, Message, GameObject } from './gameLogic.js'

class Field {
    static canvas = document.getElementById('gameField')
    static ctx = Field.canvas.getContext('2d')
    static cursorX = 0
    static cursorY = 0
    static clickX = -1
    static clickY = -1

    static backgroundTask = new Worker('gameLogic.js', { type: 'module' })
    static renderingList = []

    static renderInterval = undefined

    static images = Field.#getImages()
    static #getImages() {
        const images = new Map()
        function getImage(path) {
            const image = new Image()
            image.src = path
            return image
        }

        images.set('ball_1', getImage('img/cat.png'))
        // images.set('ball_1_pop_0', getImage('img/cat_pop0.png'))
        // images.set('ball_1_pop_1', getImage('img/cat_pop1.png'))
        // images.set('ball_1_pop_2', getImage('img/cat_pop2.png'))

        images.set('ball_2', getImage('img/ghost.png'))
        // images.set('ball_2_pop_0', getImage('img/ghost_pop0.png'))
        // images.set('ball_2_pop_1', getImage('img/ghost_pop1.png'))
        // images.set('ball_2_pop_2', getImage('img/ghost_pop2.png'))

        images.set('ball_3', getImage('img/pig.png'))
        // images.set('ball_3_pop_0', getImage('img/pig_pop0.png'))
        // images.set('ball_3_pop_1', getImage('img/pig_pop1.png'))
        // images.set('ball_3_pop_2', getImage('img/pig_pop2.png'))

        images.set('ball_4', getImage('img/pumpkin.png'))
        // images.set('ball_4_pop_0', getImage('img/pumpkin_pop0.png'))
        // images.set('ball_4_pop_1', getImage('img/pumpkin_pop1.png'))
        // images.set('ball_4_pop_2', getImage('img/pumpkin_pop2.png'))

        images.set('ball_5', getImage('img/vampire.png'))
        // images.set('ball_5_pop_0', getImage('img/vampire_pop0.png'))
        // images.set('ball_5_pop_1', getImage('img/vampire_pop1.png'))
        // images.set('ball_5_pop_2', getImage('img/vampire_pop2.png'))

        images.set('ball_6', getImage('img/zombie.png'))
        // images.set('ball_6_pop_0', getImage('img/zombie_pop0.png'))
        // images.set('ball_6_pop_1', getImage('img/zombie_pop1.png'))
        // images.set('ball_6_pop_2', getImage('img/zombie_pop2.png'))

        return images
    }

    static init() {
        function getCursor(layerX, layerY) {
            return {
                x: (Field.canvas.width / Field.canvas.offsetWidth) * layerX,
                y: (Field.canvas.height / Field.canvas.offsetHeight) * layerY
            }
        }

        Field.canvas.width = Settings.fieldWidth
        Field.canvas.height = Settings.fieldHeight

        Field.canvas.addEventListener('mousemove', (event) => {
            const cursorXY = getCursor(event.layerX, event.layerY)
            Field.cursorX = cursorXY.x
            Field.cursorY = cursorXY.y
        })

        Field.canvas.addEventListener('click', (event) => {
            const cursorXY = getCursor(event.layerX, event.layerY)
            Field.clickX = cursorXY.x
            Field.clickY = cursorXY.y
            Field.sendTaskMessage(Message.clickOnField, {
                clickX: Field.clickX,
                clickY: Field.clickY
            })
        })

        Field.backgroundTask.onmessage = Field.readTaskMessage
        Field.renderInterval = setInterval(Field.render, 1000 / Settings.maxFps)
    }

    static fps = {
        fps: 0,
        sec: new Date().getSeconds(),
        show() {
            const curSec = new Date().getSeconds()
            this.fps++
            if (this.sec !== curSec) {
                document.getElementById('fps').innerHTML = this.fps
                this.sec = curSec
                this.fps = 0
            }
        }
    }

    static render() {
        Field.ctx.clearRect(0, 0, Field.canvas.width, Field.canvas.height)

        Field.renderingList.forEach((renderingObject) => {
            const isRender =
                Boolean(renderingObject) &&
                Boolean(renderingObject.type) &&
                Boolean(GameObject[renderingObject.type]) &&
                Boolean(GameObject[renderingObject.type].render)

            if (isRender) {
                GameObject[renderingObject.type].render(renderingObject, Field)
            }
        })
        Field.fps.show()
    }

    static sendTaskMessage(message, parameter) {
        Field.backgroundTask.postMessage({ message: message, parameter: parameter })
    }

    static readTaskMessage(event) {
        if (!Array.isArray(event.data)) {
            return
        }
        Field.renderingList = event.data
    }
}

Field.init()
Field.sendTaskMessage(Message.startGame)
