const KnightAttacks = new BigInt64Array(64);
const KingAttacks = new BigInt64Array(64);
const WhitePawnAttacks = new BigInt64Array(64);
const BlackPawnAttacks = new BigInt64Array(64);

const FILE_A = 0x0101010101010101n;
const FILE_H = 0x8080808080808080n;
const RANK_1 = 0x00000000000000FFn;
const RANK_8 = 0xFF00000000000000n;

function initAttacks() {
    for (let sq = 0; sq < 64; sq++) {
        let r = Math.floor(sq / 8);
        let c = sq % 8;
        let bb = 1n << BigInt(sq);

        let kn = 0n;
        let kMoves = [[2, 1], [2, -1], [-2, 1], [-2, -1], [1, 2], [1, -2], [-1, 2], [-1, -2]];
        for (let [dr, dc] of kMoves) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) kn |= (1n << BigInt(nr * 8 + nc));
        }
        KnightAttacks[sq] = kn;

        let kg = 0n;
        let kgMoves = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
        for (let [dr, dc] of kgMoves) {
            let nr = r + dr, nc = c + dc;
            if (nr >= 0 && nr < 8 && nc >= 0 && nc < 8) kg |= (1n << BigInt(nr * 8 + nc));
        }
        KingAttacks[sq] = kg;

        let wp = 0n;
        if (c > 0 && r > 0) wp |= (1n << BigInt((r - 1) * 8 + (c - 1)));
        if (c < 7 && r > 0) wp |= (1n << BigInt((r - 1) * 8 + (c + 1)));
        WhitePawnAttacks[sq] = wp;

        let bp = 0n;
        if (c > 0 && r < 7) bp |= (1n << BigInt((r + 1) * 8 + (c - 1)));
        if (c < 7 && r < 7) bp |= (1n << BigInt((r + 1) * 8 + (c + 1)));
        BlackPawnAttacks[sq] = bp;
    }
}
initAttacks();

function bitScanForward(bb) {
    if (bb === 0n) return -1;
    let b = bb ^ (bb - 1n);
    let folded = (b ^ (b >>> 32n));
    let n = 0;
    for (; (bb & (1n << BigInt(n))) === 0n; n++) { } // Converted scan loop
    return n;
}

function popLSB(bb) {
    return bb & (bb - 1n);
}

function getLSB(bb) {
    if (bb === 0n) return -1;
    for (let index = 0; index < 64; index++) { // Converted to simple for loop
        if ((bb & (1n << BigInt(index))) !== 0n) return index;
    }
    return -1;
}

class GameState {
    constructor(player, gametime) {
        this.Player = player || 'white';
        this.gametime = gametime || 5;
        this.currentTurn = 'white';
        this.bitboards = {
            wP: 0n, wN: 0n, wB: 0n, wR: 0n, wQ: 0n, wK: 0n,
            bP: 0n, bN: 0n, bB: 0n, bR: 0n, bQ: 0n, bK: 0n
        };
        this.initializeBoard();
        this.whiteCapturedPieces = [];
        this.blackCapturedPieces = [];
        this.gameProgress = [];
        this.whitecanCastle = true;
        this.blackcanCastle = true;
        this.castlingRights = 0xF;
        this.enPassantSquare = -1;
    }

    clone() {
        const newGame = new GameState(this.Player, this.gametime);
        newGame.currentTurn = this.currentTurn;
        newGame.bitboards = { ...this.bitboards };
        newGame.whiteCapturedPieces = [...this.whiteCapturedPieces];
        newGame.blackCapturedPieces = [...this.blackCapturedPieces];
        newGame.whitecanCastle = this.whitecanCastle;
        newGame.blackcanCastle = this.blackcanCastle;
        newGame.castlingRights = this.castlingRights;
        newGame.enPassantSquare = this.enPassantSquare;
        newGame.board = this.copyBoardArray();
        newGame.gameProgress = [...this.gameProgress];
        return newGame;
    }

    initializeBoard() {
        this.bitboards.wP = 0xFF000000000000n;
        this.bitboards.wR = 0x8100000000000000n;
        this.bitboards.wN = 0x4200000000000000n;
        this.bitboards.wB = 0x2400000000000000n;
        this.bitboards.wQ = 0x0800000000000000n;
        this.bitboards.wK = 0x1000000000000000n;

        this.bitboards.bP = 0x000000000000FF00n;
        this.bitboards.bR = 0x0000000000000081n;
        this.bitboards.bN = 0x0000000000000042n;
        this.bitboards.bB = 0x0000000000000024n;
        this.bitboards.bQ = 0x0000000000000008n;
        this.bitboards.bK = 0x0000000000000010n;

        this.updateBoardArray();
    }

    updateBoardArray() {
        this.board = Array(8).fill(0).map(() => Array(8).fill(0));
        for (let i = 0; i < 64; i++) {
            let bb = 1n << BigInt(i);
            let r = Math.floor(i / 8);
            let c = i % 8;
            if (this.bitboards.wP & bb) this.board[r][c] = 'wP';
            else if (this.bitboards.wN & bb) this.board[r][c] = 'wN';
            else if (this.bitboards.wB & bb) this.board[r][c] = 'wB';
            else if (this.bitboards.wR & bb) this.board[r][c] = 'wR';
            else if (this.bitboards.wQ & bb) this.board[r][c] = 'wQ';
            else if (this.bitboards.wK & bb) this.board[r][c] = 'wK';
            else if (this.bitboards.bP & bb) this.board[r][c] = 'bP';
            else if (this.bitboards.bN & bb) this.board[r][c] = 'bN';
            else if (this.bitboards.bB & bb) this.board[r][c] = 'bB';
            else if (this.bitboards.bR & bb) this.board[r][c] = 'bR';
            else if (this.bitboards.bQ & bb) this.board[r][c] = 'bQ';
            else if (this.bitboards.bK & bb) this.board[r][c] = 'bK';
        }
    }

    copyBoard() { return this.copyBoardArray(); }
    copyBoardArray() {
        return this.board.map(row => [...row]);
    }

    getWhitePieces() {
        return this.bitboards.wP | this.bitboards.wN | this.bitboards.wB |
            this.bitboards.wR | this.bitboards.wQ | this.bitboards.wK;
    }

    getBlackPieces() {
        return this.bitboards.bP | this.bitboards.bN | this.bitboards.bB |
            this.bitboards.bR | this.bitboards.bQ | this.bitboards.bK;
    }

    getAllPieces() {
        return this.getWhitePieces() | this.getBlackPieces();
    }

    rookAttacks(sq, occ) {
        let attacks = 0n;
        let r = Math.floor(sq / 8);
        let c = sq % 8;
        for (let i = c + 1; i < 8; i++) {
            let b = 1n << BigInt(r * 8 + i);
            attacks |= b;
            if (occ & b) break;
        }
        for (let i = c - 1; i >= 0; i--) {
            let b = 1n << BigInt(r * 8 + i);
            attacks |= b;
            if (occ & b) break;
        }
        for (let i = r + 1; i < 8; i++) {
            let b = 1n << BigInt(i * 8 + c);
            attacks |= b;
            if (occ & b) break;
        }
        for (let i = r - 1; i >= 0; i--) {
            let b = 1n << BigInt(i * 8 + c);
            attacks |= b;
            if (occ & b) break;
        }
        return attacks;
    }

    bishopAttacks(sq, occ) {
        let attacks = 0n;
        let r = Math.floor(sq / 8);
        let c = sq % 8;
        for (let i = 1; r + i < 8 && c + i < 8; i++) {
            let b = 1n << BigInt((r + i) * 8 + (c + i));
            attacks |= b;
            if (occ & b) break;
        }
        for (let i = 1; r + i < 8 && c - i >= 0; i++) {
            let b = 1n << BigInt((r + i) * 8 + (c - i));
            attacks |= b;
            if (occ & b) break;
        }
        for (let i = 1; r - i >= 0 && c + i < 8; i++) {
            let b = 1n << BigInt((r - i) * 8 + (c + i));
            attacks |= b;
            if (occ & b) break;
        }
        for (let i = 1; r - i >= 0 && c - i >= 0; i++) {
            let b = 1n << BigInt((r - i) * 8 + (c - i));
            attacks |= b;
            if (occ & b) break;
        }
        return attacks;
    }

    queenAttacks(sq, occ) {
        return this.rookAttacks(sq, occ) | this.bishopAttacks(sq, occ);
    }

    isSquareAttacked(sq, byWhite) {
        let occ = this.getAllPieces();
        if (byWhite) {
            if (BlackPawnAttacks[sq] & this.bitboards.wP) return true;
            if (KnightAttacks[sq] & this.bitboards.wN) return true;
            if (KingAttacks[sq] & this.bitboards.wK) return true;
            if (this.bishopAttacks(sq, occ) & (this.bitboards.wB | this.bitboards.wQ)) return true;
            if (this.rookAttacks(sq, occ) & (this.bitboards.wR | this.bitboards.wQ)) return true;
        } else {
            if (WhitePawnAttacks[sq] & this.bitboards.bP) return true;
            if (KnightAttacks[sq] & this.bitboards.bN) return true;
            if (KingAttacks[sq] & this.bitboards.bK) return true;
            if (this.bishopAttacks(sq, occ) & (this.bitboards.bB | this.bitboards.bQ)) return true;
            if (this.rookAttacks(sq, occ) & (this.bitboards.bR | this.bitboards.bQ)) return true;
        }
        return false;
    }

    CheckDetectionOnKing() {
        let k = 0n;
        if (this.currentTurn === 'white') k = this.bitboards.wK;
        else k = this.bitboards.bK;
        let sq = getLSB(k);
        if (sq === -1) return true;
        return this.isSquareAttacked(sq, this.currentTurn !== 'white');
    }

    getPossibleMoves(from) {
        let piece = this.board[Math.floor(from / 8)][from % 8];
        if (!piece) return [];
        let isWhite = piece[0] === 'w';
        if ((isWhite && this.currentTurn !== 'white') || (!isWhite && this.currentTurn !== 'black')) return [];

        let moves = [];
        let occ = this.getAllPieces();
        let self = isWhite ? this.getWhitePieces() : this.getBlackPieces();
        let enemy = isWhite ? this.getBlackPieces() : this.getWhitePieces();
        let attacks = 0n;
        let type = piece[1];

        if (type === 'N') attacks = KnightAttacks[from];
        else if (type === 'B') attacks = this.bishopAttacks(from, occ);
        else if (type === 'R') attacks = this.rookAttacks(from, occ);
        else if (type === 'Q') attacks = this.queenAttacks(from, occ);
        else if (type === 'K') attacks = KingAttacks[from];

        attacks &= ~self;

        if (type === 'P') {
            let r = Math.floor(from / 8);
            let c = from % 8;
            if (isWhite) {
                if (r > 0 && !((occ >> BigInt((r - 1) * 8 + c)) & 1n)) {
                    moves.push((r - 1) * 8 + c);
                    if (r === 6 && !((occ >> BigInt((r - 2) * 8 + c)) & 1n)) moves.push((r - 2) * 8 + c);
                }
                let capL = WhitePawnAttacks[from] & enemy;
                for (; capL; capL &= capL - 1n) {
                    let sq = getLSB(capL);
                    moves.push(sq);
                }
            } else {
                if (r < 7 && !((occ >> BigInt((r + 1) * 8 + c)) & 1n)) {
                    moves.push((r + 1) * 8 + c);
                    if (r === 1 && !((occ >> BigInt((r + 2) * 8 + c)) & 1n)) moves.push((r + 2) * 8 + c);
                }
                let capL = BlackPawnAttacks[from] & enemy;
                for (; capL; capL &= capL - 1n) {
                    let sq = getLSB(capL);
                    moves.push(sq);
                }
            }
        } else {
            for (; attacks; attacks &= attacks - 1n) {
                let sq = getLSB(attacks);
                moves.push(sq);
            }
        }

        if (type === 'K') {
            if (isWhite) {
                if (from === 60) {
                    if ((this.castlingRights & 1) && !this.isSquareAttacked(60, false) && !this.isSquareAttacked(61, false) && !this.isSquareAttacked(62, false) &&
                        !(occ & (1n << 61n)) && !(occ & (1n << 62n))) moves.push(62);
                    if ((this.castlingRights & 2) && !this.isSquareAttacked(60, false) && !this.isSquareAttacked(59, false) && !this.isSquareAttacked(58, false) &&
                        !(occ & (1n << 59n)) && !(occ & (1n << 58n)) && !(occ & (1n << 57n))) moves.push(58);
                }
            } else {
                if (from === 4) {
                    if ((this.castlingRights & 4) && !this.isSquareAttacked(4, true) && !this.isSquareAttacked(5, true) && !this.isSquareAttacked(6, true) &&
                        !(occ & (1n << 5n)) && !(occ & (1n << 6n))) moves.push(6);
                    if ((this.castlingRights & 8) && !this.isSquareAttacked(4, true) && !this.isSquareAttacked(3, true) && !this.isSquareAttacked(2, true) &&
                        !(occ & (1n << 3n)) && !(occ & (1n << 2n)) && !(occ & (1n << 1n))) moves.push(2);
                }
            }
        }

        let legalMoves = [];
        for (let to of moves) {
            let simulatedGame = this.clone();
            simulatedGame.MovePiece(from, to, true);
            simulatedGame.switchTurn();
            if (!simulatedGame.CheckDetectionOnKing()) {
                legalMoves.push(to);
            }
        }
        return legalMoves;
    }

    MovePiece(from, to, options = {}) {
        // Handle legacy "simulation" boolean argument
        let saveHistory = true;
        let validate = true;

        if (typeof options === 'boolean') {
            saveHistory = !options;
            validate = !options;
        } else {
            if (options.saveHistory !== undefined) saveHistory = options.saveHistory;
            if (options.validate !== undefined) validate = options.validate;
        }

        if (saveHistory) {
            this.gameProgress.push({
                bitboards: { ...this.bitboards },
                turn: this.currentTurn,
                castlingRights: this.castlingRights,
                enPassantSquare: this.enPassantSquare,
                capturedWhite: [...this.whiteCapturedPieces],
                capturedBlack: [...this.blackCapturedPieces]
            });
        }

        let r1 = Math.floor(from / 8), c1 = from % 8;
        let r2 = Math.floor(to / 8), c2 = to % 8;
        let piece = this.board[r1][c1];
        let captured = this.board[r2][c2];

        if (validate) {
            let possible = this.getPossibleMoves(from);
            if (!possible.includes(to)) {
                if (saveHistory) this.gameProgress.pop();
                return [false, null];
            }
        }

        let fromBB = 1n << BigInt(from);
        let toBB = 1n << BigInt(to);

        this.bitboards[piece] &= ~fromBB;

        // Handle Promotion
        let isPromotion = false;
        // White moves to Row 0 (RANK_1)
        if (piece === 'wP' && (toBB & RANK_1)) isPromotion = true;
        // Black moves to Row 7 (RANK_8)
        if (piece === 'bP' && (toBB & RANK_8)) isPromotion = true;

        if (isPromotion) {
            // Default to Queen if not specified (important for AI)
            let promoteType = (options && options.promotion) ? options.promotion : 'Q';
            let colorPrefix = piece[0]; // 'w' or 'b'
            // Add new piece
            this.bitboards[colorPrefix + promoteType] |= toBB;
        } else {
            // Normal move
            this.bitboards[piece] |= toBB;
        }

        if (captured) {
            this.bitboards[captured] &= ~toBB;
        }

        if (piece === 'wK') {
            this.castlingRights &= ~3;
            if (from === 60 && to === 62) {
                this.bitboards.wR &= ~(1n << 63n);
                this.bitboards.wR |= (1n << 61n);
                this.board[7][7] = 0; this.board[7][5] = 'wR';
            }
            if (from === 60 && to === 58) {
                this.bitboards.wR &= ~(1n << 56n);
                this.bitboards.wR |= (1n << 59n);
                this.board[7][0] = 0; this.board[7][3] = 'wR';
            }
        }
        if (piece === 'bK') {
            this.castlingRights &= ~12;
            if (from === 4 && to === 6) {
                this.bitboards.bR &= ~(1n << 7n);
                this.bitboards.bR |= (1n << 5n);
                this.board[0][7] = 0; this.board[0][5] = 'bR';
            }
            if (from === 4 && to === 2) {
                this.bitboards.bR &= ~(1n << 0n);
                this.bitboards.bR |= (1n << 3n);
                this.board[0][0] = 0; this.board[0][3] = 'bR';
            }
        }
        if (piece === 'wR') {
            if (from === 63) this.castlingRights &= ~1;
            if (from === 56) this.castlingRights &= ~2;
        }
        if (piece === 'bR') {
            if (from === 7) this.castlingRights &= ~4;
            if (from === 0) this.castlingRights &= ~8;
        }

        this.updateBoardArray();
        this.switchTurn();

        if (saveHistory) {
            if (captured) {
                if (this.currentTurn === 'black') this.whiteCapturedPieces.push(captured);
                else this.blackCapturedPieces.push(captured);
            }
        }

        return [true, captured];
    }

    gameProgressStateDown() {
        if (this.gameProgress.length === 0) return;
        const state = this.gameProgress.pop();
        this.bitboards = { ...state.bitboards };
        this.currentTurn = state.turn;
        this.castlingRights = state.castlingRights;
        this.enPassantSquare = state.enPassantSquare;
        this.whiteCapturedPieces = [...state.capturedWhite];
        this.blackCapturedPieces = [...state.capturedBlack];
        this.updateBoardArray();
    }

    switchTurn() {
        this.currentTurn = this.currentTurn === 'white' ? 'black' : 'white';
    }

    DrawOrCheckMateDetection() {
        let noMoves = true;
        let pieces = this.currentTurn === 'white' ? this.getWhitePieces() : this.getBlackPieces();

        for (; pieces; pieces &= pieces - 1n) {
            let sq = getLSB(pieces);
            if (this.getPossibleMoves(sq).length > 0) {
                noMoves = false;
                break;
            }
        }

        if (noMoves) {
            if (this.CheckDetectionOnKing()) return "Checkmate";
            return "Stalemate";
        }
        return "None";
    }

    pawnPromotion(choice) {
        if (this.bitboards.wP & RANK_8) {
            let pawns = this.bitboards.wP & RANK_8;
            for (; pawns; pawns &= pawns - 1n) {
                let sq = getLSB(pawns);
                this.bitboards.wP &= ~(1n << BigInt(sq));
                this.bitboards['w' + choice] |= (1n << BigInt(sq));
            }
        }
        if (this.bitboards.bP & RANK_1) {
            let pawns = this.bitboards.bP & RANK_1;
            for (; pawns; pawns &= pawns - 1n) {
                let sq = getLSB(pawns);
                this.bitboards.bP &= ~(1n << BigInt(sq));
                this.bitboards['b' + choice] |= (1n << BigInt(sq));
            }
        }
        this.updateBoardArray();
    }

    PrintBoard() {
        console.log(this.board);
    }
}
