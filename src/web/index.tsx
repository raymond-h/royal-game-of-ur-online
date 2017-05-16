import deepstream = require('deepstream.io-client-js');
import React = require('react');
import ReactDOM = require('react-dom');
import Rx = require('rxjs/Rx');
import R = require('ramda');
import whenDomReady = require('when-dom-ready');

import { Game } from './game';

function fromDsRecord<T>(
	client: deepstreamIO.Client,
	recordName: string,
	triggerImmediately: boolean): Rx.Observable<T> {

	return Rx.Observable.fromEventPattern(
		handler => {
			const record = client.record.getRecord(recordName);
			record.subscribe((handler as (data: any) => void), triggerImmediately);
			return record;
		},
		(handler, record: deepstreamIO.Record) => {
			record.unsubscribe((handler as (data: any) => void));
			record.discard();
		}
	);
}

type ChildFn = (client: deepstreamIO.Client, clientData: any) => JSX.Element;

class DeepstreamClientWrapper
	extends React.Component<{ client: deepstreamIO.Client, childFn: ChildFn }, { clientData: any | null, success: boolean }> {
	constructor(props) {
		super(props);

		this.state = { success: false, clientData: null };

		this.props.client
		.login((success, data) => {
			this.setState({ success, clientData: data });
		});
	}

	render() {
		return <div>{
			(this.state.clientData == null) || (!this.state.success) ?
				<p>Wait a sec...</p> :
				this.props.childFn(this.props.client, this.state.clientData)
		}</div>;
	}
}

type GameState =
	{ state: 'awaitingOpponent', players: [string, null], gameState: any } |
	{ state: 'playing', players: [string, string], gameState: any };

interface UserInfo {
	name: string;
}

interface AppState {
	game: GameState | null;
	gameId: string | null;
	userInfos: [UserInfo | null, UserInfo | null];
	name: string;
}

class App extends React.Component<{ client: deepstreamIO.Client, clientData: any }, AppState> {
	subscription: Rx.Subscription;
	stateObs: Rx.Observable<{ game: GameState | null, gameId: string | null }>;

	userInfoRecord: deepstreamIO.Record;

	constructor(props) {
		super(props);

		this.state = {
			game: null,
			gameId: null,
			userInfos: [null, null],
			name: ''
		};

		const { client, clientData } = this.props;

		this.userInfoRecord = client.record.getRecord(`user/${clientData.username}`);

		const gameIdObs = Rx.Observable.fromEvent(window, 'hashchange')
			.map(() => location.hash)
			.startWith(location.hash)
			.map(hash => /#?(.+)/.exec(hash))
			.map(hash => (hash != null) ? hash[1] : null)
			.distinctUntilChanged();

		const gameObs = gameIdObs
			.switchMap(hash => {
				if(hash == null) { return Rx.Observable.of(null); }

				return fromDsRecord<GameState>(this.props.client, `game/${hash}`, true);
			});

		const userInfosObs = Rx.Observable.combineLatest(
			gameObs.switchMap(game => {
				if(game == null) { return Rx.Observable.of(null); }

				return fromDsRecord<UserInfo>(this.props.client, `user/${game.players[0]}`, true)
					.map(data => ({ name: 'Player #1', ...data }));
			}),

			gameObs.switchMap(game => {
				if(game == null) { return Rx.Observable.of(null); }

				return fromDsRecord<UserInfo>(this.props.client, `user/${game.players[1]}`, true)
					.map(data => ({ name: 'Player #2', ...data }));
			})
		);

		this.stateObs = Rx.Observable.combineLatest(
			gameIdObs, gameObs, userInfosObs,
			(gameId, game, userInfos) => ({ gameId, game, userInfos })
		);
	}

	componentDidMount() {
		this.subscription =
			this.stateObs.subscribe(data => {
				this.setState(data);
			});

		this.userInfoRecord.subscribe('name', name => this.setState({ name }));
	}

	componentWillUnmount() {
		this.subscription.unsubscribe();

		this.userInfoRecord.unsubscribe('name' as any);
	}

	onNewGame() {
		const userId = this.props.clientData.username;

		this.props.client.rpc.make('newGame', { userId }, (err, result) => {
			if(err) {
				return alert(`Error occured when creating new game: ${err}`);
			}

			location.hash = `#${result.gameId}`;
		});
	}

	onAcceptGame() {
		const userId = this.props.clientData.username;

		this.props.client.rpc.make('acceptGame', { userId, gameId: this.state.gameId }, (err, result) => {
			if(err) {
				return alert(`Error occured when accepting game: ${err}`);
			}

			location.hash = `#${result.gameId}`;
		});
	}

	onAction(action) {
		const userId = this.props.clientData.username;

		this.props.client.rpc.make('performAction', { userId, gameId: this.state.gameId, action }, (err, result) => {
			if(err) {
				return alert(`Error occured when performing action: ${err}`);
			}

			console.log('action went ok brah');
		});
	}

	render() {
		if(this.props.clientData.type !== 'user') {
			return <div>
				<a href='/login'>Log in (or sign up)</a>
				<p>
					Hello guest!
				</p>
				{this.state.game != null ?
					<Game
						ownPlayer={-1}
						game={this.state.game.gameState}
						userInfos={this.state.userInfos}
						spectating={true}
						onAction={() => void 0} /> :
					null
				}
			</div>;
		}

		const ownPlayer: number = this.state.game != null ?
			(this.state.game.players as [string, string]).indexOf(this.props.clientData.username) :
			-1;

		return <div>
			<a href='/logout'>Log out</a>
			<p>
				Hello <input
					value={this.state.name}
					onChange={ev => this.userInfoRecord.set('name', ev.target.value)} />!
			</p>
			<button onClick={this.onNewGame.bind(this)}>New game</button>

			{
				(
					this.state.game != null &&
					this.state.game.state === 'awaitingOpponent' &&
					this.state.game.players[0] !== this.props.clientData.username
				) ?
				<button onClick={this.onAcceptGame.bind(this)}>Accept challenge</button> :
				null
			}
			{this.state.game != null ?
				<Game
					ownPlayer={ownPlayer}
					game={this.state.game.gameState}
					userInfos={this.state.userInfos}
					spectating={!R.contains(this.props.clientData.username, this.state.game.players)}
					onAction={this.onAction.bind(this)} /> :
				null
			}
		</div>;
	}
}

whenDomReady()
.then(() => {
	const client = deepstream(process.env.DEEPSTREAM_FRONTEND_URL);

	const app = (client, clientData) => {
		return <App client={client} clientData={clientData} />;
	}

	ReactDOM.render(
		<DeepstreamClientWrapper client={client} childFn={app} />,
		document.getElementById('container')
	);
});
