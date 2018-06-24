/// <reference path="../base/utils.ts" />
/// <reference path="../base/geom.ts" />
/// <reference path="../base/entity.ts" />
/// <reference path="../base/text.ts" />
/// <reference path="../base/scene.ts" />
/// <reference path="../base/app.ts" />

///  game.ts
///


//  Initialize the resources.
let FONT: Font;
let SPRITES:ImageSpriteSheet;
addInitHook(() => {
    FONT = new Font(APP.images['font'], 'white');
    SPRITES = new ImageSpriteSheet(
	APP.images['sprites'], new Vec2(16,16), new Vec2(8,8));
});


//  Enemy
//
class Enemy extends Entity {

    hits: number = 0;
    lastHit: number = 0;

    constructor(pos: Vec2) {
	super(pos);
    }

    onCollided(entity: Entity) {
        if (entity instanceof Player) {
            let t = getTime();
            if (this.lastHit+1 < t) {
                this.lastHit = t;
                this.hits++;
                if (3 <= this.hits) {
                    this.stop();
                }
            }
        }
    }
}

class Projectile extends Enemy {

    vx: number;

    constructor(pos: Vec2, vx: number) {
	super(pos);
        this.vx = vx;
    }

    onTick() {
	super.onTick();
        this.pos.x += this.vx*4;
        this.scale = new Vec2(sign(this.vx), 1);
        if (!this.getCollider().overlaps(this.world.area)) {
            this.stop();
        }
    }
}

class Bird extends Enemy {

    vx: number;

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(1);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
        this.vx = rnd(2)*2-1;
    }

    onTick() {
	super.onTick();
        this.pos.x += this.vx;
        this.scale = new Vec2(sign(this.vx), 1);
        let area = this.world.area;
        if ((this.pos.x < area.x && this.vx < 0) ||
            (area.x1() < this.pos.x && 0 < this.vx)) {
            this.vx = -this.vx;
        }
    }
}

class Spike extends Enemy {

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(2);
	this.sprites = [sprite];
	this.collider = sprite.getBounds().inflate(-2,-2);
    }
}

class Satellite extends Projectile {

    constructor(pos: Vec2, vx: number) {
	super(pos, vx);
        let sprite = SPRITES.get(3);
        (sprite as HTMLSprite).dstRect = new Rect(-16,-16,32,32);
	this.sprites = [sprite];
	this.collider = sprite.getBounds().inflate(-2,-2);
    }
}

class Asteroid extends Enemy {

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(5);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
    }
}

class Ufo extends Projectile {

    vy: number;

    constructor(pos: Vec2, vx: number) {
	super(pos, vx);
        let sprite = SPRITES.get(4);
        (sprite as HTMLSprite).dstRect = new Rect(-16,-16,32,32);
	this.sprites = [sprite];
	this.collider = sprite.getBounds().inflate(-4,-4);
        this.vy = rnd(3)-1;
    }

    onTick() {
	super.onTick();
        this.pos.y += this.vy;
        if (rnd(10) == 0) {
            this.vy = rnd(3)-1;
        }
    }
}

class Sun extends Enemy {

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(6);
        (sprite as HTMLSprite).dstRect = new Rect(-16,-16,32,32);
	this.sprites = [sprite];
	this.collider = sprite.getBounds().inflate(-8,-8);
    }
}

class Galaxy extends Enemy {

    constructor(pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(7);
        (sprite as HTMLSprite).dstRect = new Rect(-32,-32,64,64);
	this.sprites = [sprite];
	this.collider = sprite.getBounds().inflate(-16,-16);
    }
}


//  Player
//
class Player extends Entity {

    game: Game;
    vx: number = 0;
    vy: number = 0;
    gx: number|null = null;
    dying: boolean = false;

    constructor(game: Game, pos: Vec2) {
	super(pos);
        let sprite = SPRITES.get(0);
	this.sprites = [sprite];
	this.collider = sprite.getBounds();
        this.game = game;
        this.scale = new Vec2(1, 1);
    }

    onTick() {
	super.onTick();
        let area = this.game.current.area;
        let vx = this.vx;
        if (this.gx !== null) {
            vx = this.gx - this.pos.x;
            if (Math.abs(vx) < 8) { vx = 0; }
        }
        if (vx != 0) {
            this.scale.x = sign(vx);
            this.pos.x += sign(vx)*4;
        }
        this.pos.x = clamp(area.x, this.pos.x, area.x1());
        this.scale.y = (this.dying)? -1 : 1;
        this.vy += 1;
        if (this.dying) {
            this.vy = upperbound(this.vy, 8);
        } else {
            this.vy = upperbound(this.vy, 16);
        }
        let yy = this.game.getty();
        if (0 < yy && yy < this.pos.y+this.vy) {
            this.pos.y = yy-(this.pos.y+this.vy-yy);
            this.vy = this.game.jump(this.vy);
            this.dying = false;
        } else {
	    this.pos.y += this.vy;
        }
    }

    setMove(vx: number) {
	this.vx = vx;
        this.gx = null;
    }
    setGoal(p: Vec2) {
        this.gx = p.x;
    }

    onCollided(entity: Entity) {
        if (entity instanceof Enemy) {
            if (!this.dying) {
                this.dying = true;
                this.vy = 0;
                this.game.bump();
            }
        }
    }
}


//  Game
//
class Game extends Scene {

    textbox: TextBox;
    startTime: number;
    current: World;
    player: Player;
    vy: number;
    stage: number;

    world1: World;
    clouds: StarSprite;
    impact: Vec2;

    world2: World;
    stars: StarSprite;
    nextSpawn: number;

    world3: World;
    galaxies: StarSprite;

    onStart() {
	super.onStart();
	this.textbox = new TextBox(this.screen.inflate(-16,-16), FONT);
        this.startTime = getTime();

        // World1
        {
            let area = new Rect(-this.screen.width/2, 0, this.screen.width, 1000);
            this.world1 = new World(area);
            this.world1.window = this.screen.copy();
	    this.clouds = new StarSprite(
                area.inflate(40, -80), 50, 5,
                [new OvalSprite('rgba(255,255,255,0.9)', new Rect(-20,-5,40,10)),
                 new OvalSprite('rgba(255,255,255,0.8)', new Rect(-40,-20,80,40))]);
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world1.add(new Bird(p));
            }
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world1.add(new Spike(p));
            }
            this.impact = new Vec2();
        }

        // World2
        {
            let area = new Rect(-this.screen.width, 0, this.screen.width*2, 2000);
            this.world2 = new World(area);
            this.world2.window = this.screen.scale(2);
	    this.stars = new StarSprite(
                area.inflate(0, -20), 100, 2,
                [new RectSprite('#0088ff', new Rect(-2,-2,4,4))]);
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world2.add(new Asteroid(p));
            }
            for (let i = 0; i < 1; i++) {
                let vx = rnd(2)*2-1;
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world2.add(new Satellite(p, vx));
            }
        }

        // World3
        {
            let area = new Rect(-this.screen.width*2, 0, this.screen.width*4, 4000);
            this.world3 = new World(area);
            this.world3.window = this.screen.scale(4);
	    this.galaxies = new StarSprite(
                area.inflate(0, -100), 100, 2);
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world3.add(new Sun(p));
            }
            for (let i = 0; i < 1; i++) {
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world3.add(new Galaxy(p));
            }
            for (let i = 0; i < 3; i++) {
                let vx = rnd(2)*2-1;
                let p = area.rndPt();
                p.y = clamp(0, p.y, area.height-100);
                this.world3.add(new Ufo(p, vx));
            }
        }

	this.player = new Player(this, new Vec2(0, this.world1.area.height-100));
	this.world1.add(this.player);
	this.world2.add(this.player);
	this.world3.add(this.player);

        this.stage = 1;
        this.vy = -12;
        this.nextSpawn = 0;
        this.current = this.world3;
    }

    onTick() {
	super.onTick();
	this.current.onTick();
        let target = this.player.pos.expand(
            this.current.window.width, this.current.window.height);
        let area = this.current.area;
        this.current.setCenter(target, area);

        if (this.current === this.world1) {
	    this.clouds.move(new Vec2(+1, 0));
            this.impact.y = lowerbound(0, this.impact.y-1);
            if (this.player.pos.y < 0) {
                this.player.pos.y += this.world2.area.height;
                this.current = this.world2;
                this.setStage(2);
            }

        } else if (this.current === this.world2) {
	    this.stars.move(new Vec2(1, -1));
            let t = getTime();
            if (this.nextSpawn < t) {
                let vx = rnd(2)*2-1;
                let x = (0 < vx)? 0 : area.width;
                let y = rnd(area.height-100);
                let p = new Vec2(area.x+x, area.y+y);
                this.world2.add(new Satellite(p, vx));
                this.nextSpawn = t+rnd(1,5);
            }
            if (this.player.pos.y < 0) {
                this.player.pos.y += this.world3.area.height;
                this.current = this.world3;
                this.setStage(3);
            } else if (this.world2.area.height < this.player.pos.y) {
                this.player.pos.y -= this.world2.area.height;
                this.current = this.world1;
            }

        } else if (this.current === this.world3) {
	    this.galaxies.move(new Vec2(1, 0));
            let t = getTime();
            if (this.nextSpawn < t) {
                let vx = rnd(2)*2-1;
                let x = (0 < vx)? 0 : area.width;
                let y = rnd(area.height-100);
                let p = new Vec2(area.x+x, area.y+y);
                this.world3.add(new Ufo(p, vx));
                this.nextSpawn = t+rnd(2,10);
            }
            if (this.player.pos.y < 0) {
                this.setStage(4);
            } else if (this.world3.area.height < this.player.pos.y) {
                this.player.pos.y -= this.world3.area.height;
                this.current = this.world2;
            }
        }
        let t = int(getTime()-this.startTime);
        let s = int(t/60)+':'+format(t % 60, 2, '0')
        this.textbox.clear();
        this.textbox.putText([s], 'center', 'bottom');
    }

    onDirChanged(v: Vec2) {
	this.player.setMove(v.x);
    }
    onMouseMove(p: Vec2) {
        let window = this.current.window;
        p.x = window.x + (window.width*p.x/this.screen.width);
        p.y = window.y + (window.height*p.y/this.screen.height);
	this.player.setGoal(p);
    }

    getty(): number {
        if (this.current === this.world1) {
            return this.world1.area.height-8;
        }
        return 0;
    }

    setStage(stage: number) {
        if (this.stage < stage) {
            this.stage = stage;
            this.nextSpawn = 0;
            APP.playSound('powerup');
        }
    }

    jump(vy: number): number {
        APP.playSound('jump1')
        info(vy);
        switch (this.stage) {
        case 2:
            this.vy -= 6;
            break;
        case 3:
            this.vy -= 8;
            break;
        default:
            this.vy -= 4;
            break;
        }
        this.impact = new Vec2(this.player.pos.x, 8);
        return this.vy;
    }

    bump() {
        APP.playSound('explosion');
        switch (this.stage) {
        case 2:
            this.vy = -16;
            break;
        case 3:
            this.vy = -20;
            break;
        default:
            this.vy = -12;
            break;
        }
    }

    render(ctx: CanvasRenderingContext2D) {
	super.render(ctx);
        if (this.current === this.world1) {
            let area = this.world1.area;
	    ctx.save();
	    ctx.translate(-this.world1.window.x, -this.world1.window.y);
            {
	        ctx.save();
	        ctx.translate(area.x, area.y);
                let y: number;
                for (let i = 0; i < 10; i++) {
                    let c = new Color(0,0.08+i*0.006,0.4+i*0.1);
                    y = i*area.height/20;
	            ctx.fillStyle = c.toString();
	            ctx.fillRect(0, y, area.width, area.height/20);
                }
	        ctx.fillRect(0, y, area.width, area.height-y);
	        ctx.restore();
            }
	    this.clouds.render(ctx);
            let ty = this.getty();
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(area.x, ty);
            ctx.lineTo(this.impact.x, ty+this.impact.y);
            ctx.lineTo(area.x1(), ty);
            ctx.stroke();
	    ctx.restore();
            this.current.render(ctx);

        } else if (this.current === this.world2) {
            let area = this.world2.area;
	    ctx.save();
            ctx.scale(0.5, 0.5);
            {
	        ctx.save();
	        ctx.translate(-this.world2.window.x, -this.world2.window.y);
	        ctx.save();
	        ctx.translate(area.x, area.y);
                for (let i = 0; i < 10; i++) {
                    let c = new Color(0,i*0.04,i*0.1);
                    let y = area.height/2+i*area.height/20;
	            ctx.fillStyle = c.toString();
	            ctx.fillRect(0, y, area.width, area.height/20);
                }
                ctx.restore();
	        this.stars.render(ctx);
	        ctx.restore();
            }
            this.current.render(ctx);
	    ctx.restore();

        } else if (this.current === this.world3) {
            let area = this.world3.area;
	    ctx.save();
            ctx.scale(0.25, 0.25);
            {
	        ctx.save();
	        ctx.translate(-this.world3.window.x, -this.world3.window.y);
	        ctx.save();
	        ctx.translate(area.x, area.y);
                for (let i = 0; i < 10; i++) {
                    let y = i*area.height/20;
                    let c = new Color(0.4-i*0.03,0,0);
	            ctx.fillStyle = c.toString();
	            ctx.fillRect(0, y, area.width, area.height/20);
                }
                ctx.restore();
	        this.galaxies.render(ctx);
	        ctx.restore();
            }
            this.current.render(ctx);
	    ctx.restore();
        }

	this.textbox.render(ctx);
    }
}
