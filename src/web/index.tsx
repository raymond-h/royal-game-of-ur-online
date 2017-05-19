import deepstream = require('deepstream.io-client-js');
import React = require('react');
import ReactDOM = require('react-dom');
import { BrowserRouter as Router, Route, Link } from 'react-router-dom';
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

function fromDsEvent<T>(client: deepstreamIO.Client, eventName: string): Rx.Observable<T> {
	return Rx.Observable.fromEventPattern(
		handler => client.event.subscribe(eventName, handler as (any) => void),
		handler => client.event.unsubscribe(eventName, handler as (any) => void)
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
	{ state: 'awaitingOpponent', players: [string, null], gameState: any, winner: null } |
	{ state: 'playing', players: [string, string], gameState: any, winner: null } |
	{ state: 'game-over', players: [string, string], gameState: any, winner: number };

interface UserInfo {
	name: string;
}

interface AppState {
	game: GameState | null;
	userInfos: [UserInfo | null, UserInfo | null];
}

type GameScreenProps = { client: deepstreamIO.Client, clientData: any, gameId: string };

class GameScreen extends React.Component<GameScreenProps, AppState> {
	subscriptions: Rx.Subscription[];
	gameIdSubj: Rx.Subject<string>;

	constructor(props) {
		super(props);

		this.state = {
			game: null,
			userInfos: [null, null]
		};

		this.gameIdSubj = new Rx.Subject();
	}

	componentWillReceiveProps(nextProps) {
		if(this.props.gameId !== nextProps.gameId) {
			this.gameIdSubj.next(nextProps.gameId);
		}
	}

	componentDidMount() {
		const { client, clientData, gameId } = this.props;

		const gameObs = this.gameIdSubj.switchMap(gameId =>
			fromDsRecord<GameState>(this.props.client, `game/${gameId}`, true)
		);

		const userInfoMapper = defaultName => userId => {
			if(userId == null) { return Rx.Observable.of({ name: defaultName }); }

			return fromDsRecord<UserInfo>(this.props.client, `user/${userId}`, true)
				.map(data => ({ name: defaultName, ...data }));
		};

		const userInfosObs = Rx.Observable.combineLatest(
			gameObs
			.map(game => (game == null) ? null : game.players[0])
			.switchMap(userInfoMapper('Player #1')),

			gameObs
			.map(game => (game == null) ? null : game.players[1])
			.switchMap(userInfoMapper('Player #2'))
		);

		const stateObs = Rx.Observable.combineLatest(
			gameObs, userInfosObs,
			(game, userInfos) => ({ game, userInfos })
		);

		this.subscriptions.push(
			stateObs.subscribe(data => {
				this.setState(data);
			})
		);

		const notificationsObs = Rx.Observable.merge(
			this.gameIdSubj
			.switchMap(gameId =>
				fromDsEvent<{}>(client, `game/${gameId}/game-over`)
				.mapTo({ title: 'Game over!!!!!' })
			),

			this.gameIdSubj
			.switchMap(gameId =>
				fromDsEvent<{}>(client, `game/${gameId}/players-turn/${clientData.username}`)
				.mapTo({ title: 'Your turn!!' })
			)
		);

		this.subscriptions.push(
			Rx.Observable.from(Notification.requestPermission())
				.mergeMap(() => notificationsObs)
				.subscribe(({ title }) => {
					new Notification(title, {});
				})
		);

		this.gameIdSubj.next(this.props.gameId);
	}

	componentWillUnmount() {
		for(const subscription of this.subscriptions) {
			subscription.unsubscribe();
		}
		this.subscriptions = [];
	}

	onAcceptGame() {
		const userId = this.props.clientData.username;

		this.props.client.rpc.make('acceptGame', { userId, gameId: this.props.gameId }, (err, result) => {
			if(err) {
				return alert(`Error occured when accepting game: ${err}`);
			}
		});
	}

	onAction(action) {
		const userId = this.props.clientData.username;

		this.props.client.rpc.make('performAction', { userId, gameId: this.props.gameId, userAction: action }, (err, result) => {
			if(err) {
				return alert(`Error occured when performing action: ${err}`);
			}

			console.log('action went ok brah');
		});
	}

	render() {
		const isLoggedIn = this.props.clientData.type === 'user';

		const ownPlayer: number = (isLoggedIn && this.state.game != null) ?
			(this.state.game.players as [string, string]).indexOf(this.props.clientData.username) :
			-1;

		const spectating = (isLoggedIn && this.state.game != null) ?
			!R.contains(this.props.clientData.username, this.state.game.players) :
			true;

		const onAction = (isLoggedIn && !spectating) ?
			this.onAction.bind(this) :
			() => void 0;

		return <div>
			{
				(
					isLoggedIn &&
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
					spectating={spectating}
					onAction={onAction}

					game={this.state.game.gameState}
					userInfos={this.state.userInfos}
					gameOver={this.state.game.state === 'game-over'}
					winner={this.state.game.winner} /> :
				null
			}
		</div>;
	}
}

type MainScreenProps = {
	client: deepstreamIO.Client, clientData: any,
	isLoggedIn: boolean, history: any
};

class MainScreen extends React.Component<MainScreenProps, { name: string }> {
	userInfoRecord: deepstreamIO.Record;

	constructor(props) {
		super(props);

		this.state = { name: '' };
	}

	componentDidMount() {
		const { client, clientData } = this.props;

		this.userInfoRecord = client.record.getRecord(`user/${clientData.username}`);
		this.userInfoRecord.subscribe('name', name => this.setState({ name }));
	}

	componentWillUnmount() {
		this.userInfoRecord.unsubscribe('name' as any);
		this.userInfoRecord.discard();
	}

	onNewGame() {
		const userId = this.props.clientData.username;

		this.props.client.rpc.make('newGame', { userId }, (err, result) => {
			if(err) {
				return alert(`Error occured when creating new game: ${err}`);
			}

			this.props.history.push(`/game/${result.gameId}`);
		});
	}

	render() {
		const { isLoggedIn } = this.props;

		return <div>
			{
				(!isLoggedIn) ? <div>
					<a href='/login'>Log in (or sign up)</a>
					<p>
						Hello guest!
					</p>
				</div> : <div>
					<a href='/logout'>Log out</a>
					<p>
						Hello <input
							value={this.state.name}
							onChange={ev => this.userInfoRecord.set('name', ev.target.value)} />!
					</p>
					<button onClick={this.onNewGame.bind(this)}>New game</button>
				</div>
			}
		</div>;
	}
}

class App extends React.Component<{ client: deepstreamIO.Client, clientData: any }, null> {
	render() {
		const isLoggedIn = (this.props.clientData.type === 'user');

		return <Router><div>
			<Route path='/' render={({ history }) =>
				<MainScreen {...this.props} isLoggedIn={isLoggedIn} history={history} />
			} />

			<Route path='/game/:gameId' render={({ match }) =>
				<GameScreen {...this.props} {...match.params} />
			} />
		</div></Router>;
	}
}

whenDomReady()
.then(() => {
	const client = deepstream(location.host);

	const app = (client, clientData) => {
		return <App client={client} clientData={clientData} />;
	}

	ReactDOM.render(
		<DeepstreamClientWrapper client={client} childFn={app} />,
		document.getElementById('container')
	);
});
