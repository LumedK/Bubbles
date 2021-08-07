export class Settings {
    static rows = 18
    static columns = 17
    static bubbleRadius = 24
    static bubbleSpeed = 10
    static bubbleHitRange = Settings.bubbleRadius * 1.5 // bubbleRadius < bubbleHitRange < 2 * bubbleRadius

    static fieldWidth = Settings.bubbleRadius * (2 * Settings.columns + 1)
    static fieldHeight = Settings.bubbleRadius * (2 * Settings.rows + 1) + 200

    static bubbleSpawnX = Settings.fieldWidth / 2 + 0.5 * Settings.bubbleRadius
    static bubbleSpawnY = Settings.fieldHeight - 100
    static nextBubbleSpawnX = Settings.bubbleSpawnX + 40
    static nextBubbleSpawnY = Settings.bubbleSpawnY + 40

    static aimArrowHeight = 150
    static aimArrowWidth = 30
    static minAimAngleRad = 0.1745

    static liveCounterX = Settings.bubbleRadius
    static liveCounterY = Settings.bubbleSpawnY
    static liveCounterFont = '48px serif'

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
        this.liveCounter = undefined
    }

    initiate() {
        Game.game = this
        RenderObjects.objects = []

        StaticBubble.initiate()
        this.nextBubble = new Bubble(Settings.nextBubbleSpawnX, Settings.nextBubbleSpawnY)
        new AimArrow()
        this.aimBubble = new Bubble(Settings.bubbleSpawnX, Settings.bubbleSpawnY)
        this.liveCounter = new LiveCounter()
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
            await PopSameBubbles.complete(staticBubble)
            await PopFreeBubbles.complete()
            if (Game.game.liveCounter.isEmpty) {
                await AddBubblesLines.complete()
                await PopFreeBubbles.complete()
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
            Settings.addLineRule[Bubble.possibleTypes.length - 1][
                Game.game.liveCounter.maxLives - 1
            ]

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
            this.completedMatrix.push(row.map(() => undefined))
        })

        StaticBubble.matrix.forEach((row, rowIndex) => {
            row.forEach((staticBubble, columnIndex) => {
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
                if (staticBubble.type) {
                    const targetBubble =
                        StaticBubble.matrix[rowIndex + numberOfAddingLines][columnIndex]
                    staticBubble.animation = new AddBubbleAnimation(targetBubble.y, yOffset)
                    this.completedMatrix[targetBubble.row][targetBubble.column] = staticBubble.type
                }
            })
        })
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
    static targetStaticBubble

    static async complete() {
        // waiting for click
        await new Promise((resolve, reject) => {
            this.onClick = resolve
        })

        // prepare stuff
        const aimBubble = Game.game.aimBubble
        this.bubble = new Bubble(aimBubble.x, aimBubble.y)
        this.bubble.type = aimBubble.type
        aimBubble.type = undefined

        this.bubble.animation = this.setAnimation()

        await new Promise((resolve, reject) => {
            this.onBubbleWayAnimationComplete = resolve
            sendRenderData()
        })

        // complete action
        this.targetStaticBubble.type = this.bubble.type
        this.bubble.type = undefined
        this.bubble = undefined
        Game.game.aimBubble.type = Game.game.nextBubble.type
        Game.game.nextBubble.type = Bubble.getRandomType()

        const hitStaticBubble = this.targetStaticBubble
        this.clickXY = undefined
        this.bubble = undefined
        this.targetStaticBubble = undefined

        return hitStaticBubble
    }

    static setAnimation() {
        const way = this.getWay()

        const wayList = []
        let startX, startY
        way.forEach((item) => {
            let { state, x, y } = item
            switch (state) {
                case 'start':
                    startX = x
                    startY = y
                    break
                case 'reflect':
                    wayList.push(new Vector(startX, startY, x, y))
                    startX = x
                    startY = y
                    break
                case 'hit':
                    wayList.push(
                        new Vector(
                            startX,
                            startY,
                            this.targetStaticBubble.x,
                            this.targetStaticBubble.y
                        )
                    )
                    break
            }
        })
        return new BubbleWayAnimation(wayList)
    }

    static getWay() {
        const vector = new Vector(
            Settings.bubbleSpawnX,
            Settings.bubbleSpawnY,
            this.clickXY.x,
            this.clickXY.y
        )
        const clickAngle = vector.angle
        if (Math.abs(clickAngle) < Settings.minAimAngleRad) {
            vector.angle = Settings.minAimAngleRad * (clickAngle < 0 ? -1 : 1)
        }
        const way = [{ state: 'start', x: vector.x, y: vector.y }] // states: ('start', 'reflect', 'hit')

        for (let rowIndex = Settings.rows; rowIndex >= 0; rowIndex--) {
            const line = StaticBubble.matrix[rowIndex]
            let isHit = false
            let isInCell = false
            let lineComplete = false
            let affectedBubble = undefined
            let minHitDistance = Settings.fieldWidth
            let intersectionPoint = undefined

            while (!lineComplete) {
                for (let columnIndex = 0; columnIndex < Settings.columns; columnIndex++) {
                    const staticBubble = line[columnIndex]
                    const intersection = vector.getIntersectionOfPerpendiculars(
                        staticBubble.x,
                        staticBubble.y
                    )
                    const distance = intersection.distance

                    isInCell = !staticBubble.type && distance <= staticBubble.r
                    isHit =
                        (staticBubble.type && distance <= Settings.bubbleHitRange) ||
                        (rowIndex === 0 && isInCell)
                    lineComplete = lineComplete || isInCell

                    if (isInCell) {
                        this.targetStaticBubble = staticBubble
                    }

                    if (isHit) {
                        if (distance <= minHitDistance) {
                            minHitDistance = distance
                            affectedBubble = staticBubble
                            intersectionPoint = intersection
                        }
                    }
                }
                if (affectedBubble) {
                    const targetBubbleIsLinked =
                        affectedBubble === this.targetStaticBubble ||
                        affectedBubble.adjacentBubbles.findIndex(
                            (bubble) => bubble === this.targetStaticBubble
                        ) > -1

                    if (!targetBubbleIsLinked) {
                        let minDistance
                        for (const adjacentBubble of affectedBubble.adjacentBubbles) {
                            if (adjacentBubble.type) continue
                            const length = Math.sqrt(
                                (vector.x - adjacentBubble.x) ** 2 +
                                    (vector.y - adjacentBubble.y) ** 2
                            )
                            if (!minDistance || length <= minDistance) {
                                minDistance = length
                                this.targetStaticBubble = adjacentBubble
                            }
                        }
                    }

                    way.push({
                        state: 'hit',
                        x: this.targetStaticBubble.x,
                        y: this.targetStaticBubble.y
                    })
                    //this.getTargetBubble(affectedBubble, intersectionPoint)
                    return way
                }

                if (lineComplete) break
                const outLeft = vector.getY(Settings.bubbleRadius) < vector.y

                if (outLeft) vector.setEndPointByX(Settings.bubbleRadius)
                else vector.setEndPointByX(Settings.fieldWidth - Settings.bubbleRadius)

                const sideX = vector.endPointX
                const sideY = vector.endPointY

                way.push({ state: 'reflect', x: sideX, y: sideY })
                vector.moveTo(sideX, sideY)
                vector.reflectByX()
            }
        }
    }

    // static getTargetBubble(affectedBubble, intersectionPoint, vector) {
    //     if (!affectedBubble.type) {
    //         this.targetStaticBubble = affectedBubble
    //         return
    //     }
    //     const centerHit =
    //         affectedBubble.x - intersectionPoint.x === 0 &&
    //         affectedBubble.y - intersectionPoint.y === 0
    //     vector = centerHit
    //         ? new Vector(affectedBubble.x, affectedBubble.y, vector.x, vector.y)
    //         : new Vector(
    //               affectedBubble.x,
    //               affectedBubble.y,
    //               intersectionPoint.x,
    //               intersectionPoint.y
    //           )
    //     vector.setEndPointByLength(affectedBubble.r)
    //     // the intersection point of the circle and vector
    //     const areaPointX = vector.endPointX
    //     const areaPointY = vector.endPointY
    //     const rowCorrectionDistance =
    //         Math.sqrt(5 * Settings.bubbleRadius ** 2) - 2 * Settings.bubbleRadius + 1100

    //     let minDistance
    //     for (const adjacentBubble of affectedBubble.adjacentBubbles) {
    //         if (adjacentBubble.type) continue

    //         let RowCorrection = 0
    //         if (adjacentBubble.row < affectedBubble.row) RowCorrection = rowCorrectionDistance
    //         if (adjacentBubble.row > affectedBubble.row) RowCorrection = -rowCorrectionDistance

    //         const length = Math.sqrt(
    //             (areaPointX - adjacentBubble.x) ** 2 +
    //                 (areaPointY - RowCorrection - adjacentBubble.y) ** 2
    //         )
    //         if (!minDistance || length <= minDistance) {
    //             minDistance = length
    //             this.targetStaticBubble = adjacentBubble
    //         }
    //     }
    // }
}

class PopSameBubbles extends AbstractGameEvent {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            PopSameBubbles.onWorkerMessage(command, attachment)
        }
    })()

    static onWorkerMessage(command, attachment) {
        if (command === 'BubblePopAnimation_complete') {
            this.onBubblePopAnimationComplete()
        }
    }

    static onBubblePopAnimationComplete() {}

    static bubblesToClearBySteps // Array
    static bubblesToClear // Set

    static async complete(staticBubble) {
        this.getBubblesToClear(staticBubble)

        if (this.bubblesToClear.size >= Settings.bubblesToPop) {
            this.setAnimationBySteps()
            this.sendRenderData()

            await new Promise((resolve, reject) => {
                this.onBubblePopAnimationComplete = resolve
            })

            this.clearPoppingBubble()
            this.sendRenderData()
            this.bubblesToClearBySteps = undefined
            this.bubblesToClear = undefined
        } else {
            Game.game.liveCounter.minusLive()
        }
    }

    static getBubblesToClear(staticBubble) {
        const type = staticBubble.type
        this.bubblesToClearBySteps = [[staticBubble]]
        this.bubblesToClear = new Set([staticBubble])

        for (const step of this.bubblesToClearBySteps) {
            const nextStep = []
            for (const staticBubble of step) {
                for (const adjacentBubble of staticBubble.adjacentBubbles) {
                    if (adjacentBubble.type === type && !this.bubblesToClear.has(adjacentBubble)) {
                        nextStep.push(adjacentBubble)
                        this.bubblesToClear.add(adjacentBubble)
                    }
                }
            }
            if (nextStep.length > 0) this.bubblesToClearBySteps.push(nextStep)
        }
    }

    static setAnimationBySteps() {
        this.bubblesToClearBySteps.forEach((step, stepIndex) => {
            step.forEach((staticBubble) => {
                staticBubble.animation = new BubblePopAnimation(stepIndex)
            })
        })
    }

    static clearPoppingBubble() {
        for (const staticBubble of this.bubblesToClear) {
            staticBubble.type = undefined
            staticBubble.animation = undefined
        }
    }
}

class PopFreeBubbles extends AbstractGameEvent {
    static #init = (() => {
        const preOnWorkerMessage = onWorkerMessage
        onWorkerMessage = function (command, attachment) {
            preOnWorkerMessage(command, attachment)
            PopFreeBubbles.onWorkerMessage(command, attachment)
        }
    })()

    static onWorkerMessage(command, attachment) {
        if (command === 'BubblePopAnimation_complete') {
            this.onBubblePopAnimationComplete()
        }
    }

    static onBubblePopAnimationComplete() {}

    static bubblesToClearBySteps // Array
    static bubblesToClear // Set

    static async complete(staticBubble) {
        this.getBubblesToClear(staticBubble)
        this.setAnimationBySteps()
        this.sendRenderData()

        if (this.bubblesToClear.size > 0) {
            await new Promise((resolve, reject) => {
                this.onBubblePopAnimationComplete = resolve
            })
        }
        this.clearPoppingBubble()
        this.sendRenderData()
        this.bubblesToClearBySteps = undefined
        this.bubblesToClear = undefined
    }

    static getBubblesToClear() {
        this.bubblesToClearBySteps = []
        this.bubblesToClear = new Set()

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
        for (const row of StaticBubble.matrix) {
            const step = []
            for (const staticBubble of row) {
                if (staticBubble.type && !linkedBubbles.has(staticBubble)) {
                    step.push(staticBubble)
                    this.bubblesToClear.add(staticBubble)
                }
            }
            if (step.length > 0) this.bubblesToClearBySteps.push(step)
        }
    }

    static setAnimationBySteps() {
        this.bubblesToClearBySteps.forEach((step, stepIndex) => {
            step.forEach((staticBubble) => {
                staticBubble.animation = new BubblePopAnimation(stepIndex)
            })
        })
    }

    static clearPoppingBubble() {
        for (const staticBubble of this.bubblesToClear) {
            staticBubble.type = undefined
            staticBubble.animation = undefined
        }
    }
}

class CheckGameCondition extends AbstractGameEvent {
    static complete() {
        this.checkBubblesType()
        this.checkNextBubbles()
        this.checkWinConditions()
    }

    static checkWinConditions() {
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

    static checkNextBubbles() {
        function havePossibleType(bubble) {
            return Bubble.possibleTypes.findIndex((type) => type === bubble.type) > -1
        }

        const aimBubble = Game.game.aimBubble
        const nextBubble = Game.game.nextBubble
        if (!havePossibleType(aimBubble)) aimBubble.type = Bubble.getRandomType()
        if (!havePossibleType(nextBubble)) nextBubble.type = Bubble.getRandomType()
        sendRenderData()
    }

    static checkBubblesType() {
        const types = new Set()
        StaticBubble.bubbles.forEach((staticBubble) => types.add(staticBubble.type))
        Bubble.possibleTypes = Bubble.possibleTypes.filter((type) => types.has(type))
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
        if (!bubble.type) return
        // {
        //     Render: 'BubbleRender',
        //     x: bubble.x,
        //     y: bubble.y,
        //     r: 1,
        //     type: 'bubble_0',
        //     animation: undefined
        // }
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

class LivesRender extends AbstractRender {
    static #init = (() => {
        super.init(this)
    })()

    static getRenderData(liveCounter) {
        return {
            Render: 'LivesRender',
            maxLives: liveCounter.maxLives,
            currentLives: liveCounter.currentLives
        }
    }

    static draw(field, renderData) {
        const ctx = field.ctx

        const text =
            '❤️'.repeat(renderData.currentLives) +
            '🖤'.repeat(renderData.maxLives - renderData.currentLives)
        ctx.font = Settings.liveCounterFont
        ctx.fillText(text, Settings.liveCounterX, Settings.liveCounterY)
    }
}

class BubbleWayAnimation extends AbstractRender {
    static #init = (() => {
        super.init(this)

        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            BubbleWayAnimation.afterRender(renderState)
        }

        const beforeRender = GameRender.beforeRender
        GameRender.beforeRender = function (renderState) {
            beforeRender(renderState)
            BubbleWayAnimation.beforeRender(renderState)
        }
    })()

    static isAnimationBegin = false
    static isAnimationComplete = true

    constructor(wayList) {
        super()
        this.Render = BubbleWayAnimation
        this.wayList = wayList
    }

    static getRenderData(animation) {
        if (!animation) return undefined

        const animationData = {
            Render: 'BubbleWayAnimation',
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

class BubblePopAnimation extends AbstractRender {
    static #init = (() => {
        super.init(this)
        const afterRender = GameRender.afterRender
        GameRender.afterRender = function (renderState) {
            afterRender(renderState)
            BubblePopAnimation.afterRender(renderState)
        }

        const beforeRender = GameRender.beforeRender
        GameRender.beforeRender = function (renderState) {
            beforeRender(renderState)
            BubblePopAnimation.beforeRender(renderState)
        }
    })()

    static isAnimationBegin = false
    static isAnimationComplete = true
    static starTime // ms

    static castTime = 250 // ms
    static delay = 170 // ms

    constructor(stepNumber = 0) {
        super()
        this.constructor.starTime = this.constructor.starTime || Date.now()

        this.Render = BubblePopAnimation

        this.delayCount = stepNumber * Settings.maxFps * (this.constructor.delay / 1000)
        this.dSize = -Settings.bubbleRadius / (Settings.maxFps * (this.constructor.castTime / 1000))
    }

    static getRenderData(animation) {
        if (!animation) return undefined
        const animationData = {
            Render: 'BubblePopAnimation',
            delayCount: animation.delayCount,
            dSize: animation.dSize
        }
        return animationData
    }

    static draw(field, renderData) {
        this.isAnimationBegin = true
        const animation = renderData.animation

        if (animation.delayCount > 0) {
            animation.delayCount -= 1
        } else {
            renderData.r += animation.dSize
        }

        if (renderData.r <= 0) {
            renderData.r = 0
            renderData.animation = undefined
        } else {
            this.isAnimationComplete = false
        }
    }

    static beforeRender(renderState) {
        this.isAnimationComplete = true
    }

    static afterRender(renderState) {
        if (this.isAnimationBegin && this.isAnimationComplete) {
            this.isAnimationBegin = false
            this.isAnimationComplete = true
            this.starTime = undefined
            worker.postMessage(messageToWorker('BubblePopAnimation_complete'))
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
        //const columnDistance = Math.sqrt(5 * Settings.bubbleRadius ** 2) - 2 * Settings.bubbleRadius
        const radius = Settings.bubbleRadius
        for (let row = 0; row <= Settings.rows; row++) {
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

class LiveCounter extends RenderObjects {
    constructor() {
        super()
        this.Render = LivesRender
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

// Special objects

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
        if (newXEnd === this.#xStart) throw 'vector.dx = 0!'
        this.#yEnd = this.getY(newXEnd)
        this.#xEnd = newXEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }
    setEndPointByY(newYEnd) {
        if (newYEnd === this.#yStart) throw 'vector.dy = 0!'
        this.#xEnd = this.getX(newYEnd)
        this.#yEnd = newYEnd
        this.#length = Math.sqrt(this.dx ** 2 + this.dy ** 2)
        return this
    }

    setEndPointByLength(newLength) {
        const k = this.#length / newLength
        this.setEndPointByY(this.dy / k + this.#yStart)
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

    getIntersectionOfPerpendiculars(x, y) {
        // get the intersection point of the continuation of the vector with the perpendicular from the point(x,y)
        const vectorX1 = this.#xStart
        const vectorY1 = this.#yStart
        const vectorX2 = this.#xEnd
        const vectorY2 = this.#yEnd

        const perpendicularX1 = x
        const perpendicularY1 = y
        const perpendicularX2 = x + this.dy
        const perpendicularY2 = y - this.dx

        if (vectorX2 - vectorX1 === 0) {
            return Math.sqrt((x - vectorY1) ** 2 + (y - perpendicularX1) ** 2)
        }

        // Ax + By + C = 0
        const vectorA = vectorY2 - vectorY1
        const vectorB = vectorX1 - vectorX2
        const vectorC = vectorY1 * (vectorX2 - vectorX1) - vectorX1 * (vectorY2 - vectorY1)

        const perpendicularA = perpendicularY2 - perpendicularY1
        const perpendicularB = perpendicularX1 - perpendicularX2
        const perpendicularC =
            perpendicularY1 * (perpendicularX2 - perpendicularX1) -
            perpendicularX1 * (perpendicularY2 - perpendicularY1)

        const intersectionX =
            (-vectorC * perpendicularB + perpendicularC * vectorB) /
            (vectorA * perpendicularB - perpendicularA * vectorB)
        const intersectionY =
            (-vectorA * perpendicularC + perpendicularA * vectorC) /
            (vectorA * perpendicularB - perpendicularA * vectorB)
        const length = Math.sqrt((x - intersectionX) ** 2 + (y - intersectionY) ** 2)

        return { x: intersectionX, y: intersectionY, distance: length }
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

// TODO: add mobile support
