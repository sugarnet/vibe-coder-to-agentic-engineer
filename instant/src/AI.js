import * as THREE from 'three';

export class AI {
    constructor(scene, arena, player) {
        this.scene = scene;
        this.arena = arena;
        this.player = player;
        this.health = 100;
        this.speed = 0.2;
        this.radius = 1;
        this.shootCooldown = 1000;
        this.lastShotTime = 0;
        
        this.mesh = this.createMesh();
        this.scene.add(this.mesh);
        this.resetPosition();
    }

    createMesh() {
        const group = new THREE.Group();
        
        // Body (Octahedron for a more aggressive look)
        const bodyGeom = new THREE.OctahedronGeometry(1, 0);
        const bodyMat = new THREE.MeshPhongMaterial({ 
            color: 0x111111, 
            emissive: 0xff0000,
            emissiveIntensity: 0.2,
            flatShading: true 
        });
        const body = new THREE.Mesh(bodyGeom, bodyMat);
        body.position.y = 1.5;
        group.add(body);

        // Core/Eye (Glowing)
        const eyeGeom = new THREE.SphereGeometry(0.4, 16, 16);
        const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0000 });
        const eye = new THREE.Mesh(eyeGeom, eyeMat);
        eye.position.set(0, 1.5, 0.7);
        group.add(eye);

        // Floating Cannons
        const cannonGeom = new THREE.CylinderGeometry(0.2, 0.2, 1, 8);
        const cannonMat = new THREE.MeshPhongMaterial({ color: 0x333333 });
        
        this.leftCannon = new THREE.Mesh(cannonGeom, cannonMat);
        this.leftCannon.rotation.x = Math.PI / 2;
        this.leftCannon.position.set(-1.5, 1.5, 0);
        group.add(this.leftCannon);

        this.rightCannon = new THREE.Mesh(cannonGeom, cannonMat);
        this.rightCannon.rotation.x = Math.PI / 2;
        this.rightCannon.position.set(1.5, 1.5, 0);
        group.add(this.rightCannon);

        // Bottom Thruster Glow
        const light = new THREE.PointLight(0xff0000, 2, 5);
        light.position.set(0, 0.5, 0);
        group.add(light);

        group.castShadow = true;
        return group;
    }

    resetPosition() {
        this.mesh.position.set(20, 0, 20);
        this.health = 100;
        this.bobOffset = Math.random() * Math.PI * 2;
    }

    update(projectiles) {
        const playerPos = this.player.camera.position;
        const dist = this.mesh.position.distanceTo(playerPos);

        // Face player
        this.mesh.lookAt(playerPos.x, this.mesh.position.y, playerPos.z);

        // Bobbing animation
        const time = Date.now() * 0.002;
        this.mesh.position.y = Math.sin(time + this.bobOffset) * 0.5 + 1;
        
        // Cannon rotation animation
        this.leftCannon.rotation.z += 0.05;
        this.rightCannon.rotation.z -= 0.05;

        // Move towards player if far
        if (dist > 15) {
            const dir = playerPos.clone().sub(this.mesh.position).normalize();
            const nextPos = this.mesh.position.clone().add(dir.multiplyScalar(this.speed));
            if (!this.arena.checkCollision(nextPos, this.radius)) {
                this.mesh.position.copy(nextPos);
                // Keep the y position from the bobbing
                this.mesh.position.y = Math.sin(time + this.bobOffset) * 0.5 + 1;
            }
        }

        // Shoot if close enough
        if (dist < 30) {
            const now = Date.now();
            if (now - this.lastShotTime > this.shootCooldown) {
                this.shoot(projectiles);
                this.lastShotTime = now;
            }
        }
    }

    shoot(projectiles) {
        const playerPos = this.player.camera.position;
        const dir = playerPos.clone().sub(this.mesh.position).normalize();
        const pos = this.mesh.position.clone().add(new THREE.Vector3(0, 1.5, 0)).add(dir.clone().multiplyScalar(2));

        // Muzzle flash
        const flash = new THREE.PointLight(0xff0055, 10, 5);
        flash.position.copy(pos);
        this.scene.add(flash);
        setTimeout(() => this.scene.remove(flash), 50);

        const geom = new THREE.SphereGeometry(0.2, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff0055 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.copy(pos);
        
        // Orient mesh to direction
        mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

        // Trail
        const trailGeom = new THREE.CylinderGeometry(0.1, 0.1, 1, 8);
        const trailMat = new THREE.MeshBasicMaterial({ color: 0xff0055, transparent: true, opacity: 0.5 });
        const trail = new THREE.Mesh(trailGeom, trailMat);
        trail.rotation.x = Math.PI / 2;
        trail.position.z = -0.5; // Behind the projectile
        mesh.add(trail);

        this.scene.add(mesh);

        projectiles.push({
            mesh: mesh,
            direction: dir,
            speed: 0.8,
            owner: 'ai',
            life: 150
        });
    }

    takeDamage(amount) {
        this.health -= amount;
        if (this.health <= 0) {
            this.explode();
            return true;
        }
        return false;
    }

    explode() {
        // Simple respawn for now
        this.resetPosition();
    }
}
