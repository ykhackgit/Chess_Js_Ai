const pointsofPeices = {
    'P': 1, "Q": 11, "N": 3, "B": 3, "R": 5, "K": 0
};

function play(game) {
    if (game.currentTurn === game.Player) return null;
    let availablepieces = [];
    let bb = game.currentTurn === 'white' ? game.getWhitePieces() : game.getBlackPieces();

    for (; bb; bb &= bb - 1n) {
        let sq = getLSB(bb);
        availablepieces.push(sq);
    }

    if (availablepieces.length === 0) return null;

    let take_one = availablepieces[Math.floor(Math.random() * availablepieces.length)];
    let moves = game.getPossibleMoves(take_one);
    let k = 0;

    // Converted while loop to for loop with condition check
    for (; moves.length === 0 && k < 100; k++) {
        take_one = availablepieces[Math.floor(Math.random() * availablepieces.length)];
        moves = game.getPossibleMoves(take_one);
    }
    if (moves.length === 0) return null;

    let move = moves[Math.floor(Math.random() * moves.length)];
    return { from: take_one, to: move };
}

function playwithAlfaBetaPuring(game, depth) {
    let opponent = game.Player === 'white' ? 'black' : 'white';
    let newgame = game.clone();
    let b = getBestMoveByAB(depth, newgame, opponent);
    return b;
}

function search(depth, alpha, beta, player, game) {
    if (depth === 0) {
        // Horizon Fix: Must check if game is over (Mate/Stalemate) even at leaf node.
        // Otherwise AI doesn't see "Mate in 1" if it happens exactly at depth limit.
        // This is slightly expensive but necessary for correctness.
        // Optimization: Only check if King is in check? 
        // For now, full check to be safe.

        let status = game.DrawOrCheckMateDetection();
        if (status !== "None") {
            if (status === "Checkmate") {
                // If it is checkmate, the CURRENT player (whose turn it is) has lost.
                // So the score is bad for 'player'.
                return player === 'white' ? (-100000 - depth) : (100000 + depth);
            }
            return 0; // Stalemate
        }

        let evl = evaluateBoard(game);
        return evl['white'] - evl['black'];
    }

    let opponent = player === 'white' ? 'black' : 'white';
    let moves = [];

    let pieces = player === 'white' ? game.getWhitePieces() : game.getBlackPieces();

    for (; pieces; pieces &= pieces - 1n) {
        let sq = getLSB(pieces);
        let mvs = game.getPossibleMoves(sq);
        for (let m of mvs) {
            moves.push({ from: sq, to: m });
        }
    }

    if (moves.length === 0) {
        if (game.CheckDetectionOnKing()) {
            // Mate preference:
            // If White is mated (player='white'), return very negative score. 
            // Prefer losing later (lower depth value here means closer to finding it, wait, depth counts DOWN).
            // Search called with Depth 3. 
            // Leaves is at Depth 0.
            // Immediate child is Depth 2.
            // If mate found at Depth 2: Score should be BETTER for winner than Depth 0.

            // White Wins (Black is mated):
            // Depth 2: 100000 + 2 = 100002
            // Depth 0: 100000 + 0 = 100000
            // 100002 > 100000. Correct.

            // White Loses (White is mated):
            // Depth 2: -100000 - 2 = -100002
            // Depth 0: -100000 - 0 = -100000
            // -100002 < -100000. White prefers -100000 (Later). Correct.

            return player === 'white' ? (-100000 - depth) : (100000 + depth);
        }
        return 0; // Stalemate
    }

    // ... rest of search logic ...
    if (player === 'white') {
        let maxEval = -Infinity;
        for (const move of moves) {
            game.MovePiece(move.from, move.to, { validate: false });
            let evalScore = search(depth - 1, alpha, beta, opponent, game);
            game.gameProgressStateDown();
            maxEval = Math.max(maxEval, evalScore);
            alpha = Math.max(alpha, evalScore);
            if (beta <= alpha) break;
        }
        return maxEval;
    } else {
        let minEval = Infinity;
        for (const move of moves) {
            game.MovePiece(move.from, move.to, { validate: false });
            let evalScore = search(depth - 1, alpha, beta, opponent, game);
            game.gameProgressStateDown();
            minEval = Math.min(minEval, evalScore);
            beta = Math.min(beta, evalScore);
            if (beta <= alpha) break;
        }
        return minEval;
    }
}

function getBestMoveByAB(depth, game, forPlayer) {
    let opponent = forPlayer === 'white' ? 'black' : 'white';
    let moves = [];
    let pieces = forPlayer === 'white' ? game.getWhitePieces() : game.getBlackPieces();

    for (; pieces; pieces &= pieces - 1n) {
        let sq = getLSB(pieces);
        let mvs = game.getPossibleMoves(sq);
        for (let m of mvs) {
            moves.push({ from: sq, to: m });
        }
    }

    let bestMoves = [];
    let bestMove = null;
    let alpha = -Infinity;
    let beta = Infinity;

    if (forPlayer === 'white') {
        let maxEval = -Infinity;
        for (let move of moves) {
            game.MovePiece(move.from, move.to, { validate: false });
            let evalScore = search(depth - 1, alpha, beta, opponent, game);
            game.gameProgressStateDown();

            if (evalScore > maxEval) {
                maxEval = evalScore;
                bestMoves = [move]; // New best found, reset list
            } else if (evalScore === maxEval) {
                bestMoves.push(move); // Tied for best, add to list
            }
            alpha = Math.max(alpha, evalScore);
        }
        return bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
    } else {
        let minEval = Infinity;
        for (let move of moves) {
            game.MovePiece(move.from, move.to, { validate: false });
            let evalScore = search(depth - 1, alpha, beta, opponent, game);
            game.gameProgressStateDown();

            if (evalScore < minEval) {
                minEval = evalScore;
                bestMoves = [move]; // New best found, reset list
            } else if (evalScore === minEval) {
                bestMoves.push(move); // Tied for best, add to list
            }
            beta = Math.min(beta, evalScore);
        }
        return bestMoves.length > 0 ? bestMoves[Math.floor(Math.random() * bestMoves.length)] : null;
    }
}

function countBits(bb) {
    let count = 0;
    for (; bb; bb &= bb - 1n) {
        count++;
    }
    return count;
}

function evaluateBoard(game) {
    let scoreW = 0;
    let scoreB = 0;

    scoreW += countBits(game.bitboards.wP) * pointsofPeices['P'];
    scoreW += countBits(game.bitboards.wN) * pointsofPeices['N'];
    scoreW += countBits(game.bitboards.wB) * pointsofPeices['B'];
    scoreW += countBits(game.bitboards.wR) * pointsofPeices['R'];
    scoreW += countBits(game.bitboards.wQ) * pointsofPeices['Q'];

    scoreB += countBits(game.bitboards.bP) * pointsofPeices['P'];
    scoreB += countBits(game.bitboards.bN) * pointsofPeices['N'];
    scoreB += countBits(game.bitboards.bB) * pointsofPeices['B'];
    scoreB += countBits(game.bitboards.bR) * pointsofPeices['R'];
    scoreB += countBits(game.bitboards.bQ) * pointsofPeices['Q'];

    return { 'white': scoreW, 'black': scoreB };
}

function calculateBestMove(game, level) {
    // Direct mapping: Level 1-5 -> Depth 1-5
    // Cap at Depth 5 for performance on web
    let depth = level;
    if (depth > 5) depth = 5;

    // Safety check
    if (depth < 1) depth = 1;

    console.log(`AI thinking at Depth ${depth}`);
    return playwithAlfaBetaPuring(game, depth);
}
