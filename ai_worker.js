importScripts('chess.js', 'chessai_palyrandom.js');

self.onmessage = function (e) {
    const { message, gameState, level } = e.data;

    if (message === 'search') {
        try {
            const game = new GameState();
            Object.assign(game.bitboards, gameState.bitboards);
            game.currentTurn = gameState.currentTurn;
            game.Player = gameState.Player;
            game.whitecanCastle = gameState.whitecanCastle;
            game.blackcanCastle = gameState.blackcanCastle;
            game.castlingRights = gameState.castlingRights;
            game.enPassantSquare = gameState.enPassantSquare;
            game.board = gameState.board;

            const move = calculateBestMove(game, level || 3); // Default to level 3 if undefined

            self.postMessage({ type: 'move', move: move });
        } catch (error) {
            console.error("Worker Error:", error);
            self.postMessage({ type: 'error', error: error.toString() });
        }
    }
};
