import assert = require('assert');
import R = require('ramda');

interface State {
    players: [PlayerState, PlayerState];
    currentPlayer: number;
    lastRoll: number | null;
}

interface PlayerState {
    wonPieces: number;
    outOfPlayPieces: number;
    fieldedPieces: { position: number }[];
}

export const initialState: State = {
    players: [
        { wonPieces: 0, outOfPlayPieces: 7, fieldedPieces: [] },
        { wonPieces: 0, outOfPlayPieces: 7, fieldedPieces: [] }
    ],
    currentPlayer: 0,
    lastRoll: null
};

function isDangerZone(position: number): boolean {
    return 4 <= position && position <= 11;
}

function isSafeSpot(position: number): boolean {
    return position == 7;
}

function isRerollSpot(position: number): boolean {
    return position == 3 || position == 7 || position == 13;
}

function hasPieceAt(state: State, player: number, position: number): boolean {
    const pieces = state.players[player].fieldedPieces;

    return R.any(R.propEq('position', position), pieces);
}

function passToNextPlayer(state: State): State {
    return { ...state, currentPlayer: (state.currentPlayer + 1) % (state.players.length) };
}

export const actionHandlers = {
    setDiceRolls(state: State, { roll }: { type: 'setDiceRolls', roll: number }) {
        assert.ok(state.lastRoll == null, 'Cannot roll more than once');

        return { ...state, lastRoll: roll };
    },

    addPiece(state: State, action: { type: 'addPiece' }) {
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

    movePiece(state: State, { index }: { type: 'movePiece', index: number }) {
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

    pass(state: State, action: { type: 'pass' }) {
        return passToNextPlayer({ ...state, lastRoll: null });
    }
};

export function reducer(state: State, action) {
    return actionHandlers[action.type](state, action);
}
