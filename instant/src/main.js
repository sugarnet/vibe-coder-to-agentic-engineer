import * as THREE from 'three';
import { Arena } from './Arena';
import { Player } from './Player';
import { AI } from './AI';

class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new THREE.WebGLRenderer({ canvas: this.canvas, antialias: true });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(window.devicePixelRatio);
        this.renderer.shadowMap.enabled = true;

        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x050505);
        this.scene.fog = new THREE.Fog(0x050505, 50, 150);

        this.camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
        this.camera.position.set(0, 1.6, 0); // Eye level

        this.projectiles = [];
        this.score = 0;
        this.round = 1;
        this.playerWins = 0;
        this.aiWins = 0;
        this.isGameOver = false;

        this.initLights();
        this.arena = new Arena(this.scene);
        this.player = new Player(this.camera, this.arena);
        this.ai = new AI(this.scene, this.arena, this.player);

        this.scene.add(this.camera);

        window.addEventListener('resize', () => this.onResize());
        document.getElementById('restart-btn').addEventListener('click', () => this.restart());

        this.animate();
    }

    initLights() {
        const ambient = new THREE.AmbientLight(0x404040, 2);
        this.scene.add(ambient);

        const sun = new THREE.DirectionalLight(0x00f2ff, 3);
        sun.position.set(50, 100, 50);
        sun.castShadow = true;
        sun.shadow.camera.left = -60;
        sun.shadow.camera.right = 60;
        sun.shadow.camera.top = 60;
        sun.shadow.camera.bottom = -60;
        this.scene.add(sun);

        const point = new THREE.PointLight(0xff0055, 2, 50);
        point.position.set(0, 2, 0);
        this.scene.add(point);
    }

    onResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }

    updateProjectiles() {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            p.mesh.position.add(p.direction.clone().multiplyScalar(p.speed));
            p.life--;

            // Collision with walls
            if (this.arena.checkCollision(p.mesh.position, 0.2)) {
                this.removeProjectile(p, i);
                continue;
            }

            // Collision with target
            if (p.owner === 'player') {
                const dist = p.mesh.position.distanceTo(this.ai.mesh.position);
                if (dist < this.ai.radius + 0.5) {
                    if (this.ai.takeDamage(10)) {
                        this.score += 100;
                        document.getElementById('score-value').textContent = this.score;
                        this.endRound('player');
                    }
                    this.removeProjectile(p, i);
                    continue;
                }
            } else if (p.owner === 'ai') {
                const dist = p.mesh.position.distanceTo(this.camera.position);
                if (dist < 1.5) {
                    if (this.player.takeDamage(5)) {
                        this.endRound('ai');
                    }
                    this.removeProjectile(p, i);
                    continue;
                }
            }

            if (p.life <= 0) {
                this.removeProjectile(p, i);
            }
        }
    }

    removeProjectile(p, index) {
        this.scene.remove(p.mesh);
        this.projectiles.splice(index, 1);
    }

    endRound(winner) {
        if (winner === 'player') {
            this.playerWins++;
            document.getElementById('player-wins').textContent = `P: ${this.playerWins}`;
        } else {
            this.aiWins++;
            document.getElementById('ai-wins').textContent = `AI: ${this.aiWins}`;
        }

        if (this.playerWins >= 2 || this.aiWins >= 2) {
            this.gameOver(winner);
        } else {
            this.startNextRound();
        }
    }

    startNextRound() {
        this.round++;
        document.getElementById('round-value').textContent = this.round;
        this.resetRoundState();
    }

    resetRoundState() {
        // Clear projectiles
        this.projectiles.forEach(p => this.scene.remove(p.mesh));
        this.projectiles = [];

        // Reset positions and health
        this.player.health = 100;
        document.getElementById('health-bar').style.width = '100%';
        this.camera.position.set(0, 1.6, 0);
        this.player.rotation = 0;
        this.ai.resetPosition();
    }

    gameOver(winner) {
        this.isGameOver = true;
        document.getElementById('overlay').classList.remove('hidden');
        document.getElementById('status-message').textContent = winner === 'player' ? 'VICTORY!' : 'DEFEAT!';
        document.getElementById('status-message').style.color = winner === 'player' ? '#00f2ff' : '#ff0055';
    }

    restart() {
        this.isGameOver = false;
        this.score = 0;
        this.round = 1;
        this.playerWins = 0;
        this.aiWins = 0;
        document.getElementById('round-value').textContent = '1';
        document.getElementById('player-wins').textContent = 'P: 0';
        document.getElementById('ai-wins').textContent = 'AI: 0';
        document.getElementById('health-bar').style.width = '100%';
        document.getElementById('score-value').textContent = '0';
        document.getElementById('overlay').classList.add('hidden');
        this.resetRoundState();
    }

    animate() {
        requestAnimationFrame(() => this.animate());

        if (!this.isGameOver) {
            this.player.update(this.projectiles);
            this.ai.update(this.projectiles);
            this.updateProjectiles();
        }

        this.renderer.render(this.scene, this.camera);
    }
}

new Game();
