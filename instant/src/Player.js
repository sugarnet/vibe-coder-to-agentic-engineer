import * as THREE from 'three';

export class Player {
    constructor(camera, arena) {
        this.camera = camera;
        this.arena = arena;
        this.moveSpeed = 0.5;
        this.turnSpeed = 0.05;
        this.velocity = new THREE.Vector3();
        this.direction = new THREE.Vector3();
        this.rotation = 0;
        this.health = 100;
        this.radius = 1;
        
        this.keys = {
            ArrowUp: false,
            ArrowDown: false,
            ArrowLeft: false,
            ArrowRight: false,
            Space: false
        };

        this.initControls();
        this.lastShotTime = 0;
        this.shootCooldown = 250; // ms
    }

    initControls() {
        window.addEventListener('keydown', (e) => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = true;
        });
        window.addEventListener('keyup', (e) => {
            if (this.keys.hasOwnProperty(e.code)) this.keys[e.code] = false;
        });
    }

    update(projectiles) {
        // Rotation
        if (this.keys.ArrowLeft) this.rotation += this.turnSpeed;
        if (this.keys.ArrowRight) this.rotation -= this.turnSpeed;
        this.camera.rotation.y = this.rotation;

        // Movement
        this.direction.set(0, 0, 0);
        if (this.keys.ArrowUp) {
            this.direction.z = -1;
        }
        if (this.keys.ArrowDown) {
            this.direction.z = 1;
        }

        if (this.direction.length() > 0) {
            this.direction.applyEuler(new THREE.Euler(0, this.rotation, 0));
            const nextPos = this.camera.position.clone().add(this.direction.multiplyScalar(this.moveSpeed));
            
            if (!this.arena.checkCollision(nextPos, this.radius)) {
                this.camera.position.copy(nextPos);
            }
        }

        // Shooting
        if (this.keys.Space) {
            const now = Date.now();
            if (now - this.lastShotTime > this.shootCooldown) {
                this.shoot(projectiles);
                this.lastShotTime = now;
            }
        }
    }

    shoot(projectiles) {
        const dir = new THREE.Vector3(0, 0, -1).applyEuler(this.camera.rotation);
        const pos = this.camera.position.clone().add(dir.clone().multiplyScalar(1));
        
        // Muzzle flash
        this.createMuzzleFlash(pos);

        projectiles.push({
            mesh: this.createProjectileMesh(pos, dir),
            direction: dir,
            speed: 1.5,
            owner: 'player',
            life: 100
        });
    }

    createMuzzleFlash(pos) {
        const light = new THREE.PointLight(0x00f2ff, 10, 5);
        light.position.copy(pos);
        this.camera.parent.add(light);
        setTimeout(() => this.camera.parent.remove(light), 50);
    }

    createProjectileMesh(pos, dir) {
        const geom = new THREE.SphereGeometry(0.1, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0x00f2ff });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        
        // Orient mesh to direction
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
        
        // Add trail (pointing opposite to movement)
        const trailGeom = new THREE.CylinderGeometry(0.05, 0.05, 1, 8);
        const trailMat = new THREE.MeshBasicMaterial({ color: 0x00f2ff, transparent: true, opacity: 0.5 });
        const trail = new THREE.Mesh(trailGeom, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.5; // Behind the projectile
        mesh.add(trail);

        this.camera.parent.add(mesh); // Add to scene
        return mesh;
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health < 0) this.health = 0;
        document.getElementById('health-bar').style.width = this.health + '%';
        return this.health <= 0;
    }
}
