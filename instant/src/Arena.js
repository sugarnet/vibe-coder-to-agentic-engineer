import * as THREE from 'three';

export class Arena {
    constructor(scene) {
        this.scene = scene;
        this.size = 100;
        this.wallHeight = 10;
        this.walls = [];
        this.createEnvironment();
    }

    createEnvironment() {
        // Floor
        const floorGeometry = new THREE.PlaneGeometry(this.size, this.size);
        const floorMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x222222, 
            side: THREE.DoubleSide,
            emissive: 0x111111
        });
        const floor = new THREE.Mesh(floorGeometry, floorMaterial);
        floor.rotation.x = -Math.PI / 2;
        floor.receiveShadow = true;
        this.scene.add(floor);

        // Grid helper for sci-fi look
        const grid = new THREE.GridHelper(this.size, 20, 0x00f2ff, 0x333333);
        grid.position.y = 0.01;
        this.scene.add(grid);

        // Walls
        const wallMaterial = new THREE.MeshPhongMaterial({ 
            color: 0x111111,
            transparent: true,
            opacity: 0.8,
            emissive: 0x333333
        });
        
        const createWall = (width, height, depth, x, z, ry = 0) => {
            const geom = new THREE.BoxGeometry(width, height, depth);
            const mesh = new THREE.Mesh(geom, wallMaterial);
            mesh.position.set(x, height / 2, z);
            mesh.rotation.y = ry;
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            this.scene.add(mesh);
            this.walls.push(mesh);
        };

        const halfSize = this.size / 2;
        createWall(this.size, this.wallHeight, 1, 0, -halfSize); // North
        createWall(this.size, this.wallHeight, 1, 0, halfSize);  // South
        createWall(this.size, this.wallHeight, 1, -halfSize, 0, Math.PI / 2); // West
        createWall(this.size, this.wallHeight, 1, halfSize, 0, Math.PI / 2);  // East

        // Some obstacles
        this.createObstacle(5, 5, 5, 10, 10);
        this.createObstacle(8, 4, 8, -15, -10);
        this.createObstacle(4, 10, 4, 20, -15);
        this.createObstacle(6, 6, 6, -5, 20);
    }

    createObstacle(w, h, d, x, z) {
        const geom = new THREE.BoxGeometry(w, h, d);
        const mat = new THREE.MeshPhongMaterial({ color: 0x444444, emissive: 0x111111 });
        const mesh = new THREE.Mesh(geom, mat);
        mesh.position.set(x, h / 2, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        this.scene.add(mesh);
        this.walls.push(mesh);
    }

    checkCollision(position, radius) {
        for (const wall of this.walls) {
            const box = new THREE.Box3().setFromObject(wall);
            const playerBox = new THREE.Box3().setFromCenterAndSize(
                position, 
                new THREE.Vector3(radius * 2, 2, radius * 2)
            );
            if (box.intersectsBox(playerBox)) {
                return true;
            }
        }
        return false;
    }
}
