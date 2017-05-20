import assert = require('assert');
import R = require('ramda');

export interface State {
    players: [PlayerState, PlayerState];
    currentPlayer: number;
    lastRoll: number | null;
}

export interface PlayerState {
    wonPieces: number;
    outOfPlayPieces: number;
    fieldedPieces: Piece[];
}

export interface Piece {
    position: number;
}

export const initialState: State = {
    players: [
        { wonPieces: 0, outOfPlayPieces: 7, fieldedPieces: [] },
        { wonPieces: 0, outOfPlayPieces: 7, fieldedPieces: [] }
    ],
    currentPlayer: 0,
    lastRoll: null
};

export function opponentPlayer(state: State, player: number) {
    return (player+1) % (state.players.length);
}

export function isDangerZone(position: number): boolean {
    return 4 <= position && position <= 11;
}

export function isSafeSpot(position: number): boolean {
    return position == 7;
}

export function isRerollSpot(position: number): boolean {
    return position == 3 || position == 7 || position == 13;
}

export function hasPieceAt(state: State, player: number, position: number): boolean {
    const pieces = state.players[player].fieldedPieces;

    return R.any(R.propEq('position', position), pieces);
}

function canMoveTo(state: State, player: number, position: number): boolean {
    if(state.lastRoll == null || state.lastRoll == 0) return false;

    if(position > 14) {
        return false;
    }
    else if(hasPieceAt(state, player, position)) {
        return false;
    }
    else if(
        isSafeSpot(position) && hasPieceAt(state, opponentPlayer(state, player), position)
    ) {
        return false;
    }
    else return true;
}

function passToNextPlayer(state: State): State {
    return { ...state, currentPlayer: (state.currentPlayer + 1) % (state.players.length) };
}

export function hasWinner(state: State): [boolean, number | null] {
    for(let i = 0; i < 2; i++) {
        if(state.players[i].wonPieces === 7) {
            return [true, i];
        }
    }

    return [false, null];
}

export function potentialMoves(state: State): { type: string, index?: number, to?: number }[] {
    if(state.lastRoll == null) {
        return [{ type: 'roll' }];
    }

    const lastRoll = state.lastRoll;

    const currentPlayer = state.players[state.currentPlayer];

    const potentialMovablePieces =
        currentPlayer.fieldedPieces
        .filter(
            piece => canMoveTo(state, state.currentPlayer, piece.position + lastRoll)
        );

    const moves = potentialMovablePieces
        .map((piece, index) => ({ type: 'movePiece', index, to: piece.position + lastRoll }));

    const canAddPiece = !hasPieceAt(state, state.currentPlayer, lastRoll);

    return R.pipe(
        R.when(() => canAddPiece, R.append({ type: 'addPiece' })),
        R.when(R.isEmpty, R.append({ type: 'pass' }))
    )(moves);
}

export const actionHandlers = {
    setDiceRolls(state: State, { roll }: { type: 'setDiceRolls', roll: number }): State {
        assert.ok(state.lastRoll == null, 'Cannot roll more than once');

        return { ...state, lastRoll: roll };
    },

    addPiece(state: State, action: { type: 'addPiece' }): State {
        assert.ok(state.lastRoll != null, 'Must roll first');
        assert.ok(state.lastRoll != 0, 'Must roll a number greater than 1 to add a piece');

        const player = state.currentPlayer;

        assert.ok(state.players[player].outOfPlayPieces > 0,
            'Player is out of pieces to add');

        const newState = R.clone(state);

        const newPosition = (state.lastRoll as number)-1;

        assert.ok(!hasPieceAt(state, player, newPosition),
            'Cannot add piece to occupied spot');

        newState.players[player].outOfPlayPieces -= 1;
        newState.players[player].fieldedPieces.push({
            position: newPosition
        });
        newState.lastRoll = null;

        // only pass when not hitting a reroll spot (3, 7, 13)
        return isRerollSpot(newPosition) ? newState : passToNextPlayer(newState);
    },

    movePiece(state: State, { index }: { type: 'movePiece', index: number }): State {
        assert.ok(state.lastRoll != null, 'Must roll first');
        assert.ok(state.lastRoll != 0, 'Must roll a number greater than 1 to move');

        const player = state.currentPlayer;

        const newState = R.clone(state);

        const piece = state.players[player].fieldedPieces[index];
        const newPosition = piece.position + (state.lastRoll as number);

        assert.ok(newPosition <= 14, 'Cannot move piece outside of board');

        assert.ok(!hasPieceAt(state, player, newPosition),
            'Cannot move piece to same spot as another of own pieces');

        if(newPosition == 14) {
            // piece reached the end, increase won pieces for player
            newState.players[player].wonPieces += 1;
            newState.players[player].fieldedPieces.splice(index, 1);
        }
        else {
            // if there is an opponent piece on same position,
            // and it's a danger zone (in middle lane),
            // remove opponent piece
            const opponentPlayer = (player + 1) % (state.players.length);
            
            if(isDangerZone(newPosition) && hasPieceAt(state, opponentPlayer, newPosition)) {
                assert.ok(!isSafeSpot(newPosition),
                    'Cannot move piece to the safe spot in danger zone if enemy occupies it');

                const opponentFieldedPieces = state.players[opponentPlayer].fieldedPieces;

                const enemyPieceIndex = R.findIndex(
                    R.propEq('position', newPosition),
                    opponentFieldedPieces
                );

                newState.players[opponentPlayer].fieldedPieces.splice(enemyPieceIndex, 1);
                newState.players[opponentPlayer].outOfPlayPieces += 1;
            }

            // move current piece to newPosition
            newState.players[player].fieldedPieces[index].position = newPosition;
        }

        newState.lastRoll = null;

        // only pass when not hitting a reroll spot (3, 7, 13)
        return isRerollSpot(newPosition) ? newState : passToNextPlayer(newState);
    },

    pass(state: State, action: { type: 'pass' }): State {
        return passToNextPlayer({ ...state, lastRoll: null });
    }
};

export function reducer(state: State, action): State {
    return actionHandlers[action.type](state, action);
}

function diceRoll() {
    const coinFlip = () => (Math.random() < 0.5) ? 1 : 0;

    return coinFlip() + coinFlip() + coinFlip() + coinFlip();
}

export function moveToAction(move) {
    const moveActionMappers = {
        roll(data) {
            return { type: 'setDiceRolls', roll: diceRoll() };
        },

        addPiece(data) {
            return { type: 'addPiece' };
        },

        movePiece(data) {
            return { type: 'movePiece', index: data.index };
        },

        pass(data) {
            return { type: 'pass' };
        }
    };

    return moveActionMappers[move.type](move);
}
