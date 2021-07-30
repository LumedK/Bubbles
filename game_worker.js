export class Settings {
    static rows = 18
    static columns = 17
    static bubbleRadius = 24
    static bubbleSpeed = 10
    static bubbleHitRange = Settings.bubbleRadius * 1.25

    static fieldWidth = Settings.bubbleRadius * (2 * Settings.columns + 1)
    static fieldHeight = Settings.bubbleRadius * (2 * Settings.rows + 1) + 200

    static bubbleSpawnX = Settings.fieldWidth / 2 + 0.5 * Settings.bubbleRadius
    static bubbleSpawnY = Settings.fieldHeight - 100
    static nextBubbleSpawnX = Settings.bubbleSpawnX + 40
    static nextBubbleSpawnY = Settings.bubbleSpawnY + 40

    static aimArrowHeight = 150
    static aimArrowWidth = 30
    static minAimAngleRad = 0.1745

    static maxFps = 60

    static bubblesToPop = 3
    static maxLives = 4
    static addLineRule = [
        [4, 5, 6, 7],
        [3, 4, 5, 6],
        [2, 3, 4, 5],
        [1, 2, 3, 4],
        [1, 2, 3, 4],
        [1, 1, 2, 2]
    ] // ROW: possible balls; COLUMN: max lives; VALUE: number of adding lines
}

export function setWorker(setWorker) {
    worker = setWorker
}

let worker = undefined

export function messageToWorker(command = '', attachment) {
    return { command: command, attachment: attachment }
}

function messageToMainstream(command = undefined) {
    return {
        command: command,
        renderDataList: RenderObjects.getRenderData()
    }
}

function sendRenderData() {
    postMessage(messageToMainstream())
}

class Game {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            Game.onWorkerMessage(command, attachment)
        }
    })()

    static game = undefined

    constructor() {
        this.finished = false
        this.aimBubble = undefined
        this.nextBubble = undefined
        this.lives = new Lives()
    }

    initiate() {
        Game.game = this
        RenderObjects.objects = []
        new AimArrow()
        this.aimBubble = new Bubble(Settings.bubbleSpawnX, Settings.bubbleSpawnY)
        this.nextBubble = new Bubble(Settings.nextBubbleSpawnX, Settings.nextBubbleSpawnY)
        StaticBubble.initiate()
    }

    static onWorkerMessage(command, attachment) {
        if (command === 'start_new_game') {
            new Game().loop()
        }
    }

    async loop() {
        const game = this
        game.initiate()
        await AddBubblesLines.complete(10)

        while (!Game.game.finished) {
            const staticBubble = await ShootBubble.complete()
            PopSameBubbles.complete(staticBubble)
            PopFreeBubbles.complete()
            if (Game.game.lives.isEmpty) {
                await AddBubblesLines.complete()
                PopFreeBubbles.complete()
            }
            CheckGameCondition.complete()
        }
    }
}

// Game events

class AbstractGameEvent {
    static complete() {
        this.sendRenderData()
    }
    static sendRenderData() {
        sendRenderData()
    }
    // static sendRenderData(workerMessage = 'event_complete') {
    //     //sendMessageToMainstream(workerMessage)
    // }
}

class AddBubblesLines_Old extends AbstractGameEvent {
    static complete(numberOfAddingLines) {
        if (!numberOfAddingLines) {
            numberOfAddingLines =
                Settings.addLineRule[Bubble.possibleTypes.length - 1][Game.game.lives.maxLives - 1]
        }

        // shift bubbles lines
        let rowOffset = undefined
        for (const staticBubble of StaticBubble.bubbles.slice().reverse()) {
            if (!staticBubble.type) continue
            rowOffset = rowOffset || Math.min(numberOfAddingLines, Settings.rows - staticBubble.row)
            const offsetBubble =
                StaticBubble.matrix[staticBubble.row + rowOffset][staticBubble.column]
            offsetBubble.type = staticBubble.type
            staticBubble.type = undefined
        }
        rowOffset = rowOffset || numberOfAddingLines
        // add bubbles
        function addBubblesLine() {
            for (let row = 0; row < rowOffset; row++) {
                for (const staticBubble of StaticBubble.matrix[row]) {
                    staticBubble.type = Bubble.getRandomType()
                }
            }
        }
        function checkTypes() {
            const types = new Set()
            for (const staticBubble of StaticBubble.bubbles) {
                if (!staticBubble.type) continue
                types.add(staticBubble.type)
            }
            return types.size === Bubble.possibleTypes.length
        }

        while (true) {
            addBubblesLine()
            if (checkTypes()) break
        }

        this.sendRenderData()
    }
}

class AddBubblesLines extends AbstractGameEvent {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            AddBubblesLines.onWorkerMessage(command, attachment)
        }
    })()

    static onWorkerMessage(command, attachment) {
        if (command === 'addBubbleAnimation_complete') {
            this.onAddBubbleAnimationComplete()
        }
    }

    static onAddBubbleAnimationComplete() {}
    static completedMatrix = []
    static addedBubbles = new Set()

    static async complete(numberOfAddingLines) {
        numberOfAddingLines = this.getNumberOfAddingLines(numberOfAddingLines)
        const typeList = this.getSetOfRandomType(numberOfAddingLines)
        this.fillCompleteMatrix(numberOfAddingLines, typeList)

        sendRenderData()

        await new Promise((resolve, reject) => {
            this.onAddBubbleAnimationComplete = resolve
        })

        this.setCompletedMatrix()
        sendRenderData()
    }

    static getNumberOfAddingLines(numberOfAddingLines) {
        numberOfAddingLines =
            numberOfAddingLines ||
            Settings.addLineRule[Bubble.possibleTypes.length - 1][Game.game.lives.maxLives - 1]

        let bottomRowWithBubble = 0
        for (let i = StaticBubble.bubbles.length - 1; i >= 0; i--) {
            if (StaticBubble.bubbles[i].type) {
                bottomRowWithBubble = StaticBubble.bubbles[i].row
                break
            }
        }

        numberOfAddingLines = Math.min(Settings.rows - bottomRowWithBubble, numberOfAddingLines)
        return numberOfAddingLines
    }

    static getSetOfRandomType(numberOfAddingLines) {
        const typeList = []
        const checkTypes = new Set([Game.game.aimBubble.type])
        for (let i = 0; i < numberOfAddingLines * Settings.columns; i++) {
            let type = Bubble.getRandomType()
            typeList.push(type)
            checkTypes.add(type)
        }
        if (Bubble.possibleTypes.length !== checkTypes.size) {
            this.getSetOfRandomType(numberOfAddingLines)
        }
        return typeList
    }

    static fillCompleteMatrix(numberOfAddingLines, typeList) {
        const yOffset = 2 * Settings.bubbleRadius * numberOfAddingLines

        StaticBubble.matrix.forEach((row) => {
            this.completedMatrix.push(row.map((bubble) => bubble.type))
        })

        for (let rowIndex = 0; rowIndex < Settings.rows; rowIndex++) {
            for (let columnIndex = 0; columnIndex < Settings.columns; columnIndex++) {
                const staticBubble = StaticBubble.matrix[rowIndex][columnIndex]
                if (staticBubble.type) {
                    const targetBubble =
                        StaticBubble.matrix[rowIndex + numberOfAddingLines][columnIndex]
                    staticBubble.animation = new AddBubbleAnimation(targetBubble.y, yOffset)
                    this.completedMatrix[targetBubble.row][targetBubble.column] = staticBubble.type
                }
                if (rowIndex < numberOfAddingLines) {
                    const newBubble = new Bubble(
                        staticBubble.x,
                        staticBubble.y - yOffset,
                        typeList.pop()
                    )
                    newBubble.animation = new AddBubbleAnimation(staticBubble.y, yOffset)
                    this.completedMatrix[rowIndex][columnIndex] = newBubble.type
                    this.addedBubbles.add(newBubble)
                }
            }
        }
    }

    static setCompletedMatrix() {
        this.completedMatrix.forEach((lane, rowIndex) => {
            lane.forEach((type, columnIndex) => {
                const staticBubble = StaticBubble.matrix[rowIndex][columnIndex]
                staticBubble.type = type
                staticBubble.animation = undefined
            })
        })

        RenderObjects.objects.forEach((object, index) => {
            if (this.addedBubbles.has(object)) RenderObjects.objects[index] = undefined
        })

        this.completedMatrix = []
        this.addedBubbles = new Set()
    }
}

class ShootBubble extends AbstractGameEvent {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            ShootBubble.onWorkerMessage(command, attachment)
        }
    })()

    static onWorkerMessage(command, attachment) {
        if (command === 'click') {
            this.clickXY = attachment
            this.onClick()
        }

        if (command === 'bubbleWayAnimation_complete') {
            this.onBubbleWayAnimationComplete()
        }
    }

    static clickXY = undefined
    static onClick() {}
    static onBubbleWayAnimationComplete() {}

    static bubble
    static staticBubble
    static wayList = []

    static async complete() {
        // waiting for click
        //sendMessageToMainstream('waiting_for_click')
        await new Promise((resolve, reject) => {
            this.onClick = resolve
        })

        // prepare stuff
        const aimBubble = Game.game.aimBubble
        this.bubble = new Bubble(aimBubble.x, aimBubble.y)
        this.bubble.type = aimBubble.type
        aimBubble.type = undefined

        this.bubble.animation = this.setAnimation()

        // waiting for complete animation
        await new Promise((resolve, reject) => {
            //sendMessageToMainstream('waiting_for_complete_animation')
            this.onBubbleWayAnimationComplete = resolve
            sendRenderData()
        })

        // complete action
        this.staticBubble.type = this.bubble.type
        this.bubble.type = undefined
        this.bubble = undefined
        Game.game.aimBubble.type = Game.game.nextBubble.type
        Game.game.nextBubble.type = Bubble.getRandomType()

        //sendMessageToMainstream()

        const hitStaticBubble = this.staticBubble
        this.clickXY = undefined
        this.bubble = undefined
        this.staticBubble = undefined
        this.wayList = []

        return hitStaticBubble
    }

    static setAnimation() {
        this.getWayList()
        const lastVector = this.wayList[this.wayList.length - 1]
        this.addToWayList(
            new Vector(
                lastVector.endPointX,
                lastVector.endPointY,
                this.staticBubble.x,
                this.staticBubble.y
            )
        )

        return new RenderBubbleWayAnimation(this.wayList)
    }

    static addToWayList(vector) {
        const way = vector.copy()
        this.wayList.push(way)
    }

    static getStaticBubble(line, aimVector) {
        let x = 0
        const y = line[0].y
        let outLeft = false
        let outRight = false

        function checkOutSide(aimVector) {
            aimVector.setEndPointByY(y).endPointX
            x = aimVector.setEndPointByY(y).endPointX
            outLeft = x < Settings.bubbleRadius
            outRight = x > Settings.fieldWidth - Settings.bubbleRadius
        }

        checkOutSide(aimVector)
        while (outLeft || outRight) {
            // set a vector's end point (across vertical sides)
            const xSide = outLeft
                ? Settings.bubbleRadius
                : Settings.fieldWidth - Settings.bubbleRadius
            aimVector.setEndPointByX(xSide)
            // add this vector to the way list
            this.addToWayList(aimVector)
            // move and reflect the vector at the side point
            aimVector.moveTo(aimVector.endPointX, aimVector.endPointY)
            aimVector.reflectByX()
            // check 'outLeft' and 'outRight'
            checkOutSide(aimVector)
        }

        // the 'x' is inside a line
        for (let staticBubble of line) {
            const isXInsideBubble =
                staticBubble.x - Settings.bubbleRadius <= x &&
                x <= staticBubble.x + Settings.bubbleRadius
            if (isXInsideBubble) return staticBubble
        }
    }

    static getWayList() {
        const clickXY = this.clickXY

        let aimVector = new Vector(
            Settings.bubbleSpawnX,
            Settings.bubbleSpawnY,
            clickXY.x,
            clickXY.y
        )
        const clickAngle = aimVector.angle
        if (Math.abs(clickAngle) < Settings.minAimAngleRad) {
            aimVector.angle = Settings.minAimAngleRad * (clickAngle < 0 ? -1 : 1)
        }

        for (let line of StaticBubble.matrix.slice().reverse()) {
            const staticBubble = this.getStaticBubble(line, aimVector)

            const isEmptyBubble = !staticBubble.type
            // While game is running, the bottom line should have empty bubbles
            if (!isEmptyBubble) {
                aimVector.setEndPointByY(this.staticBubble.y)
                //<bug fix>: When the vector was reflected and the point on the new line was rejected, the direction of the vector became incorrect
                if (aimVector.dy > 0) {
                    aimVector = this.wayList.pop()
                    aimVector.setEndPointByX(this.staticBubble.x)
                }
                //</bug fix>
                this.addToWayList(aimVector)
                return
            }

            this.staticBubble = staticBubble

            const isLeftBubbleInHitRange =
                staticBubble.column > 0 &&
                StaticBubble.matrix[staticBubble.row][staticBubble.column - 1].x +
                    Settings.bubbleHitRange >=
                    staticBubble.x
            const isRightBubbleInHitRange =
                staticBubble.column < Settings.columns - 1 &&
                StaticBubble.matrix[staticBubble.row][staticBubble.column + 1].x -
                    Settings.bubbleHitRange <=
                    staticBubble.x

            if (isLeftBubbleInHitRange || isRightBubbleInHitRange) {
                aimVector.setEndPointByY(staticBubble.y)
                this.addToWayList(aimVector)
                return
            }
        }
    }
}

class PopSameBubbles extends AbstractGameEvent {
    static complete(staticBubble) {
        const type = staticBubble.type
        const bubbleToClearBySteps = [[staticBubble]]
        const SameTypeBubbles = new Set([staticBubble])

        for (const step of bubbleToClearBySteps) {
            const nextStep = []
            for (const staticBubble of step) {
                for (const adjacentBubble of staticBubble.adjacentBubbles) {
                    if (adjacentBubble.type === type && !SameTypeBubbles.has(adjacentBubble)) {
                        nextStep.push(adjacentBubble)
                        SameTypeBubbles.add(adjacentBubble)
                    }
                }
            }
            if (nextStep.length > 0) bubbleToClearBySteps.push(nextStep)
        }

        if (SameTypeBubbles.size >= Settings.bubblesToPop) {
            this.clearPoppingBubble(bubbleToClearBySteps)
        } else {
            Game.game.lives.minusLive()
        }

        this.sendRenderData()
    }

    static clearPoppingBubble(bubbleToClearBySteps) {
        // future: pop animation
        for (const step of bubbleToClearBySteps) {
            for (const bubble of step) {
                bubble.type = undefined
            }
        }
    }
}

class PopFreeBubbles extends AbstractGameEvent {
    static complete() {
        const linkedBubbles = new Set()
        // add static bubbles from 1st row
        for (const staticBubble of StaticBubble.matrix[0]) {
            if (staticBubble.type) linkedBubbles.add(staticBubble)
        }
        // get linked static bubbles
        for (const staticBubble of linkedBubbles) {
            for (const adjacentBubbles of staticBubble.adjacentBubbles) {
                if (adjacentBubbles.type) linkedBubbles.add(adjacentBubbles)
            }
        }
        // get suspended bubbles
        const bubbleToClearBySteps = []
        for (const row of StaticBubble.matrix) {
            const step = []
            for (const staticBubble of row) {
                if (staticBubble.type && !linkedBubbles.has(staticBubble)) {
                    step.push(staticBubble)
                }
            }
            if (step.length > 0) bubbleToClearBySteps.push(step)
        }

        this.clearPoppingBubble(bubbleToClearBySteps)
        this.sendRenderData()
    }

    static clearPoppingBubble(bubbleToClearBySteps) {
        // future: pop animation
        for (const step of bubbleToClearBySteps) {
            for (const bubble of step) {
                bubble.type = undefined
            }
        }
    }
}

class CheckGameCondition extends AbstractGameEvent {
    static complete() {
        let win = true
        for (const bubble of StaticBubble.matrix[0]) {
            win = win && !bubble.type
        }

        let lose = false
        for (const bubble of StaticBubble.matrix[StaticBubble.matrix.length - 1]) {
            if (bubble.type) {
                lose = true
                break
            }
        }

        Game.game.finished = win || lose
        if (win) postMessage(messageToMainstream('game_over_win'))
        if (lose) postMessage(messageToMainstream('game_over_lose'))
    }
}

// Renders

export const Renders = {}

class AbstractRender {
    static init = (subRender) => {
        Renders[subRender.name] = subRender
    }
    static getRenderData() {}
    static draw() {}
}

class GameRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
    })()

    constructor() {
        super()
        this.field
        this.interval
        this.renderDataList = []
    }
    run() {
        const field = this.field
        field.ctx.clearRect(0, 0, field.canvas.width, field.canvas.height)
        if (!this.renderDataList) return

        const renderState = { beforeRender: undefined, onRender: undefined, afterRender: undefined }
        this.constructor.beforeRender(renderState)

        for (const renderData of this.renderDataList) {
            this.constructor.onRender(renderState)
            try {
                const render = Renders[renderData.Render]
                render.draw(this.field, renderData)
            } catch (error) {
                console.log('render error', error)
                continue
            }
        }

        this.constructor.afterRender(renderState)
    }

    static beforeRender = function (renderState) {}
    static onRender = function (renderState) {}
    static afterRender = function (renderState) {}
}

class FPSRender extends GameRender {
    static #init = (() => {
        super.init(this)

        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            FPSRender.afterRender(renderState)
        }
    })()

    static startingSecond = 0
    static counter = 0
    static HTMLElement

    static afterRender = function (renderState) {
        this.HTMLElement = this.HTMLElement ? this.HTMLElement : document.getElementById('fps')
        const currentSecond = new Date().getSeconds()
        const showFPS = this.startingSecond !== currentSecond
        if (showFPS) {
            this.HTMLElement.innerHTML = this.counter
            this.startingSecond = currentSecond
            this.counter = 0
        } else {
            this.counter++
        }
    }
}

class BubbleRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
    })()

    static getRenderData(bubble) {
        if (!bubble.type)
            return {
                Render: 'BubbleRender',
                x: bubble.x,
                y: bubble.y,
                r: 1,
                type: 'bubble_0',
                animation: undefined
            }
        return {
            Render: 'BubbleRender',
            x: bubble.x,
            y: bubble.y,
            r: bubble.r,
            type: bubble.type,
            animation: bubble?.animation?.Render?.getRenderData(bubble.animation)
        }
    }

    static images = new Map([
        ['bubble_0', 'red'],
        ['bubble_1', 'green'],
        ['bubble_2', 'blue'],
        ['bubble_3', 'yellow'],
        ['bubble_4', 'orange'],
        ['bubble_5', 'purple']
    ])

    static draw(field, renderData) {
        if (renderData.animation) {
            Renders[renderData.animation.Render].draw(field, renderData)
        }

        const ctx = field.ctx

        ctx.fillStyle = this.images.get(renderData.type)
        ctx.beginPath()
        ctx.arc(renderData.x, renderData.y, renderData.r, 0, 2 * Math.PI, false)
        ctx.fill()
    }
}

class AimArrowRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
    })()

    static getRenderData(aimArrow) {
        return {
            Render: 'AimArrowRender',
            x: Settings.bubbleSpawnX,
            y: Settings.bubbleSpawnY,
            length: Settings.aimArrowLength
        }
    }

    static draw(field, renderData) {
        const ctx = field.ctx
        const image = field.Images.aim_arrow

        const dxCursor = field.cursorX - Settings.bubbleSpawnX
        const dyCursor = field.cursorY - Settings.bubbleSpawnY
        const angle = Math.atan(dxCursor / dyCursor)

        const translateX = Settings.bubbleSpawnX
        const translateY = Settings.bubbleSpawnY

        ctx.translate(translateX, translateY)
        ctx.rotate(-angle)
        ctx.drawImage(
            image,
            Settings.aimArrowWidth / 2,
            0,
            -Settings.aimArrowWidth,
            -Settings.aimArrowHeight
        )
        ctx.rotate(+angle)
        ctx.translate(-translateX, -translateY)
    }
}

class RenderBubbleWayAnimation extends AbstractRender {
    static #init = (() => {
        super.init(this)

        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            RenderBubbleWayAnimation.afterRender(renderState)
        }

        const beforeRender = GameRender.beforeRender
        GameRender.beforeRender = function (renderState) {
            beforeRender(renderState)
            RenderBubbleWayAnimation.beforeRender(renderState)
        }
    })()

    static isAnimationBegin = false
    static isAnimationComplete = true

    constructor(wayList) {
        super()
        this.Render = RenderBubbleWayAnimation
        this.wayList = wayList
    }

    static getRenderData(animation) {
        if (!animation) return undefined

        const animationData = {
            Render: 'RenderBubbleWayAnimation',
            count: 0,
            dx: 0,
            dy: 0,
            steps: []
        }
        for (let vector of animation.wayList) {
            const k = vector.length / Settings.bubbleSpeed
            const step = {
                count: Math.floor(k),
                dx: vector.dx / k,
                dy: vector.dy / k
            }
            animationData.steps.push(step)
        }

        return animationData
    }

    static draw(field, renderData) {
        const animation = renderData.animation

        this.isAnimationBegin = true

        if (animation.count <= 0) {
            const step = animation.steps.shift()
            if (step) {
                animation.count = step.count
                animation.dx = step.dx
                animation.dy = step.dy
            }
        }

        if (animation.count <= 0) {
            renderData.animation = undefined
            return
        }
        renderData.x += animation.dx
        renderData.y += animation.dy
        animation.count--
        this.isAnimationComplete = false
    }

    static beforeRender(renderState) {
        this.isAnimationComplete = true
    }

    static afterRender(renderState) {
        if (this.isAnimationBegin && this.isAnimationComplete) {
            this.isAnimationBegin = false
            this.isAnimationComplete = true
            worker.postMessage(messageToWorker('bubbleWayAnimation_complete'))
        }
    }
}

class AddBubbleAnimation extends AbstractRender {
    static #init = (() => {
        super.init(this)
        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            AddBubbleAnimation.afterRender(renderState)
        }

        const beforeRender = GameRender.beforeRender
        GameRender.beforeRender = function (renderState) {
            beforeRender(renderState)
            AddBubbleAnimation.beforeRender(renderState)
        }
    })()

    static isAnimationBegin = false
    static isAnimationComplete = true

    constructor(yTarget, yOffset) {
        super()
        this.Render = AddBubbleAnimation
        this.yTarget = yTarget
        this.yOffset = yOffset
    }

    static getRenderData(animation) {
        if (!animation) return undefined
        const animationData = {
            Render: 'AddBubbleAnimation',
            count: Math.ceil(animation.yOffset / (Settings.bubbleSpeed / 1)),
            dy: Settings.bubbleSpeed / 1,
            yTarget: animation.yTarget
        }
        return animationData
    }

    static draw(field, renderData) {
        this.isAnimationBegin = true

        const animation = renderData.animation
        if (animation.count > 0) {
            animation.count -= 1
            renderData.y += animation.dy

            this.isAnimationComplete = false
        } else {
            renderData.y = animation.yTarget
            renderData.animation = undefined
        }
    }

    static beforeRender(renderState) {
        this.isAnimationComplete = true
    }

    static afterRender(renderState) {
        if (this.isAnimationBegin && this.isAnimationComplete) {
            this.isAnimationBegin = false
            this.isAnimationComplete = true
            worker.postMessage(messageToWorker('addBubbleAnimation_complete'))
        }
    }
}

// Game objects

class RenderObjects {
    static objects = []
    constructor() {
        RenderObjects.objects.push(this)
        this.Render = AbstractRender
    }

    static getRenderData() {
        RenderObjects.objects = RenderObjects.objects.filter((object) => Boolean(object))

        const renderDataList = []
        for (const object of RenderObjects.objects) {
            if (!object) continue
            const renderData = object.Render.getRenderData(object)
            if (!renderData) continue
            renderDataList.push(object.Render.getRenderData(object))
        }

        return renderDataList
    }
}

class Bubble extends RenderObjects {
    static possibleTypes = ['bubble_0', 'bubble_1', 'bubble_2', 'bubble_3', 'bubble_4', 'bubble_5']
    constructor(x, y, type) {
        super()
        this.Render = BubbleRender
        this.x = x
        this.y = y
        this.r = Settings.bubbleRadius
        this.type = type === undefined ? this.constructor.getRandomType() : type
        this.animation = undefined
    }

    static getRandomType() {
        return Bubble.possibleTypes[getRandomInt(0, Bubble.possibleTypes.length - 1)]
    }
}

class StaticBubble extends Bubble {
    static bubbles = []
    static matrix = []

    constructor({ row, column, x, y }) {
        super(x, y)
        this.type = undefined
        this.row = row
        this.column = column
        this.r = Settings.bubbleRadius
        StaticBubble.bubbles.push(this)
        this.adjacentBubbles = []

        if (!StaticBubble.matrix[row]) StaticBubble.matrix[row] = []
        StaticBubble.matrix[row][column] = this
    }

    static initiate() {
        const radius = Settings.bubbleRadius
        for (let row = 0; row <= Settings.rows; row++) {
            // StaticBubble.matrix[row] = []
            for (let column = 0; column < Settings.columns; column++) {
                new StaticBubble({
                    row: row,
                    column: column,
                    x: radius * (2 * column + 1 + (row % 2)),
                    y: radius * (2 * row + 1)
                })
            }
        }

        // get adjacent bubbles
        for (let bubble of StaticBubble.bubbles) {
            function add(bubble, row, column) {
                if (!StaticBubble.matrix[row]) return
                if (!StaticBubble.matrix[row][column]) return
                bubble.adjacentBubbles.push(StaticBubble.matrix[row][column])
            }
            // add(bubble, bubble.row, bubble.column) // current
            add(bubble, bubble.row, bubble.column - 1) // left cell
            add(bubble, bubble.row, bubble.column + 1) // right cell
            add(bubble, bubble.row - 1, bubble.column) // top cell
            add(bubble, bubble.row + 1, bubble.column) // bottom cell
            const shift = bubble.row % 2 === 0 ? -1 : +1
            add(bubble, bubble.row - 1, bubble.column + shift) // top shift cell
            add(bubble, bubble.row + 1, bubble.column + shift) // bottom shift cell
        }
    }
}

class AimArrow extends RenderObjects {
    constructor() {
        super()
        this.Render = AimArrowRender
    }
}

// Special objects

class Lives {
    constructor() {
        this.maxLives = Settings.maxLives
        this.currentLives = Settings.maxLives
    }
    minusLive() {
        this.currentLives--
    }

    get isEmpty() {
        if (this.currentLives === 0) {
            this.currentLives = this.maxLives
            return true
        }
        return false
    }
}

class Vector {
    #xStart
    #yStart
    #xEnd
    #yEnd
    #length

    constructor(x1 = 0, y1 = 0, x2 = 0, y2 = 0) {
        this.#xStart = x1
        this.#yStart = y1
        this.#xEnd = x2
        this.#yEnd = y2
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
    }

    get x() {
        return this.#xStart
    }
    get y() {
        return this.#yStart
    }
    get dx() {
        // the difference between the start and end point by X
        return this.#xEnd - this.#xStart
    }
    get dy() {
        // the difference between the start and end point by Y
        return this.#yEnd - this.#yStart
    }
    get endPointX() {
        return this.#xEnd
    }
    get endPointY() {
        return this.#yEnd
    }
    get length() {
        return this.#length
    }
    get angle() {
        return Math.atan(this.dy / this.dx)
    }
    set angle(newAngle) {
        this.#xEnd = Math.cos(newAngle) * this.length + this.#xStart
        this.#yEnd = Math.sin(newAngle) * this.length + this.#yStart
    }

    getX(y) {
        // get the x in a line that includes start and end points
        const k = this.dy / (y - this.#yStart)
        return this.dx / k + this.#xStart
    }
    getY(x) {
        // get the y in a line that includes start and end points
        const k = this.dx / (x - this.#xStart)
        return this.dy / k + this.#yStart
    }

    setEndPointByX(newXEnd) {
        this.#yEnd = this.getY(newXEnd)
        this.#xEnd = newXEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }
    setEndPointByY(newYEnd) {
        this.#xEnd = this.getX(newYEnd)
        this.#yEnd = newYEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }

    moveTo(x, y) {
        // replace vector by start point
        const dx = this.dx
        const dy = this.dy
        this.#xStart = x
        this.#xEnd = this.#xStart + dx
        this.#yStart = y
        this.#yEnd = this.#yStart + dy
        return this
    }

    reflectByX() {
        // reflect vector by X
        this.#xEnd = this.#xEnd - 2 * this.dx
        return this
    }

    copy() {
        return new Vector(this.#xStart, this.#yStart, this.#xEnd, this.#yEnd)
    }
}

function getRandomInt(min = 0, max = 10) {
    if (max <= min) return min
    return Math.floor(Math.random() * (max - min + 1)) + min
}

onmessage = function (event) {
    const { command, attachment } = event.data
    onWorkerMessage(command, attachment)
}

function onWorkerMessage(command, attachment) {}

// TODO: add pop animation
// TODO: rework bubble collisions
// TODO: make pretty view
