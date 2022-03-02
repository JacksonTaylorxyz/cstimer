"use strict";

var timer = execMain(function(regListener, regProp, getProp, pretty, ui, pushSignal) {
	var container;

	/**
	 * n: n phase(s) before stop
	 * -1: idle
	 * -2: ready to start (space pressed)
	 * -3: inspecting
	 * -4: ready to inspection (space pressed)
	 */
	var status = -1;

	var curTime = []; //[inspection time, phaseN, phaseN-1, ...]
	var startTime;

	var rawMoves = [];

	function reset() {
		var type = getProp('input');
		status = -1;

		virtual333.setEnable(type == 'v' || type == 'q');
		virtual333.reset();
		lcd.setEnable(type != 'i');
		lcd.reset(type == 'v' || type == 'q' || type == 'g' && getProp('giiVRC'));
		keyboardTimer.reset();
		inputTimer.setEnable(type == 'i');
		ui.setAutoShow(true);
	}

	var nPhases = {
		'n': 1,
		'cfop': 4,
		'fp': 2,
		'roux': 4,
		'cf4op': 7,
		'cf4o2p2': 9
	}

	var phaseNames = {
		'n': [],
		'cfop': ['cross', 'F2L', 'OLL', 'PLL'],
		'fp': ['F2L', 'LL'],
		'roux': ['1st block', '2nd block', 'CMLL', 'L6E'],
		'cf4op': ['cross', '1st F2L', '2nd F2L', '3rd F2L', '4th F2L', 'OLL', 'PLL'],
		'cf4o2p2': ['cross', '1st F2L', '2nd F2L', '3rd F2L', '4th F2L', 'EOLL', 'COLL', 'CPLL', 'EPLL'],
	}

	function checkUseIns() {
		var ret = getProp('useIns');
		if (ret === true || ret == 'a') {
			return true;
		} else if (ret === false || ret == 'n') {
			return false;
		} else if (ret == 'b') {
			return /^(333ni|444bld|555bld|r3ni)$/.exec(getProp('scrType')) == null;
		}
	}

	var lcd = (function() {

		var div;
		var rightDiv = $('<div />');
		var runningDiv;
		var runningId;

		var staticAppend = "";
		var divDict = ["", ""];

		var lasttime = 0;

		function setRunning(run, right) {
			if (run && runningId == undefined) {
				requestAnimFrame(runningThread);
				runningId = 1;
				lasttime = 0;
			} else if (!run && runningId != undefined) {
				runningId = undefined;
			}
			runningDiv = right ? rightDiv : div;
		}

		function runningThread(timestamp) {
			if (status == 0 || status == -1 || status == -4 || runningId == undefined) {
				return;
			}
			var time = $.now() - startTime;
			var curAppend = runningDiv === rightDiv ? staticAppend : "";
			if (status == -3 || (status == -2 && checkUseIns())) {
				setHtml(runningDiv, (getProp('timeU') != 'n' ? ((time > 17000) ? 'DNF' : (time > 15000) ? '+2' : 15 - ~~(time / 1000)) : TIMER_INSPECT) + curAppend);
			} else { //>0
				var pret = pretty(time, true);
				setHtml(runningDiv, {
					'u': pret,
					'c': pret.replace(/([.>])(\d)\d+(<|$)/, "$1$2$3"),
					's': pret.split(".")[0],
					'n': TIMER_SOLVE,
					'i': TIMER_SOLVE
				} [getProp('timeU')] + curAppend);
			}

			if (status == -3 || status == -2) { //inspection alert
				if (runningDiv !== rightDiv) {
					if (time >= 12000) {
						setHtml(rightDiv, '<div style="font-family: Arial;">Go!!!&nbsp;&nbsp;</div>');
					} else if (time >= 8000) {
						setHtml(rightDiv, '<div style="font-family: Arial;">8s!&nbsp;&nbsp;</div>');
					}
				}
			}

			lasttime = time;
			requestAnimFrame(runningThread);
		}

		function fixDisplay(isKeyDown, isSpace) {
			var run = false;
			if (status == 0) {
				lcd.color('red');
			} else if (status == -1 || status == -4) {
				setColor(isKeyDown && isSpace ? (checkUseIns() ? '#0d0' : '#f00') : '');
			} else if (status == -2) {
				setColor(isKeyDown && isSpace ? '#0d0' : '');
				run = checkUseIns();
			} else if (status == -3) {
				setColor(isKeyDown && isSpace ? '#dd0' : '#f00');
				run = true;
			} else {
				setColor(isKeyDown ? '#0d0' : '');
				run = true;
			}
			ui.setAutoShow(status == 0 || status == -1);
			setRunning(run);
		}

		function setColor(val) {
			div.css('color', val);
			rightDiv.css('color', val);
		}

		function setValue(val, right) {
			setHtml(right ? rightDiv : div, val != undefined ? pretty(val, true) : '--:--');
		}

		function setHtml(div, val) {
			var idx = div === rightDiv ? 1 : 0;
			if (divDict[idx] === val) {
				return;
			}
			divDict[idx] = val;
			div.html(val);
		}

		function append(val) {
			setHtml(rightDiv, rightDiv.html() + val);
		}

		function setStaticAppend(val, append) {
			if (append) {
				staticAppend += val;
			} else {
				staticAppend = val;
			}
		}

		function setEnable(enable) {
			if (enable) {
				div.show();
			} else {
				div.hide();
			}
		}

		function reset(right) {
			div.empty();
			rightDiv.empty();
			divDict[0] = "";
			divDict[1] = "";
			setValue(0, right);
			setRunning(false);
			staticAppend = "";
		}


		function getMulPhaseAppend(curProgress, totPhases) {
			var ret = [];
			for (var i = totPhases; i > curProgress; i--) {
				ret.push(pretty(curTime[i] - ~~curTime[i + 1], true));
			}
			return curProgress == totPhases || totPhases == 1 ? '' :
				'<div style="font-size: 0.65em">' + '=' + ret.join('<br>+') + '</div>';
		}

		$(function() {
			div = $('#lcd');
			$('#multiphase').append(rightDiv);
		});

		return {
			setRunning: setRunning,
			color: setColor,
			val: setValue,
			setEnable: setEnable,
			append: append,
			setStaticAppend: setStaticAppend,
			fixDisplay: fixDisplay,
			getMulPhaseAppend: getMulPhaseAppend,
			reset: reset
		}
	})();

	var avgDiv = (function() {
		var avgDiv;
		var avgDiv1 = $('<span class="click">');
		var avgDiv2 = $('<span class="click">');

		var isShowAvgDiv = true;

		function showAvgDiv(enable) {
			if (enable && getProp('showAvg') && $.inArray(getProp('input'), ['s', 'm', 't', 'i']) != -1) {
				if (!isShowAvgDiv) {
					avgDiv.show();
					isShowAvgDiv = true;
				}
			} else {
				if (isShowAvgDiv) {
					avgDiv.hide();
					isShowAvgDiv = false;
				}
			}
		}

		function procSignal(signal, value) {
			avgDiv1.html(value[0]).unbind('click');
			if (value[2] != undefined) {
				avgDiv1.addClass('click').click(function() {
					value[4](value[2][0], value[2][1], value[2][2], value[2][3]);
				});
			} else {
				avgDiv1.removeClass('click');
			}
			avgDiv2.html(value[1]).unbind('click');
			if (value[3] != undefined) {
				avgDiv2.addClass('click').click(function() {
					value[4](value[3][0], value[3][1], value[3][2], value[3][3]);
				});
			} else {
				avgDiv2.removeClass('click');
			}
		}

		$(function() {
			avgDiv = $('#avgstr').append(avgDiv1, '<br>', avgDiv2);
			regListener('timer', 'avg', procSignal);
		})

		return {
			showAvgDiv: showAvgDiv
		}
	})();

	var keyboardTimer = (function() {

		var lastDown = 0;
		var lastStop = 0;
		var pressreadyId = undefined;

		function clearPressReady() {
			if (pressreadyId != undefined) {
				clearTimeout(pressreadyId);
				pressreadyId = undefined;
			}
		}

		function onkeyup(keyCode, isTrigger) {
			var now = $.now();
			if (isTrigger) {
				if (status == 0) {
					status = -1;
				} else if (status == -1 || status == -3) {
					clearPressReady();
					if (now - lastStop < 500) {
						lcd.fixDisplay(false, isTrigger);
						return;
					}
				} else if (status == -2) {
					var time = now;
					status = getProp('phases');
					var insTime = checkUseIns() ? (time - startTime) : 0;
					curTime = [insTime > 17000 ? -1 : (insTime > 15000 ? 2000 : 0)];
					startTime = time;
					lcd.reset();
				} else if (status == -4) {
					status = -3;
					lcd.reset();
					startTime = now;
				}
			}
			lcd.fixDisplay(false, isTrigger);
			if (isTrigger) {
				kernel.clrKey();
			}
		}

		function onkeydown(keyCode, isTrigger) {
			var now = $.now();
			if (now - lastDown < 200) {
				return;
			}
			if (status > 0) {
				lastDown = now;
				curTime[status] = lastDown - startTime;
				getProp('phases') != status && lcd.append('+');
				getProp('phases') != 1 && lcd.append(pretty(curTime[status] - ~~curTime[status + 1], true) + '&nbsp;<br>');
				if (keyCode == 27) {
					var times = [-1],
						i = 1;
					while (status < curTime.length) {
						times[i++] = curTime[status++];
					}
					status = 1;
					curTime = times;
				}
				if (--status == 0) {
					lastStop = lastDown;
					lcd.val(curTime[1]);
					ui.setAutoShow(true);
					pushSignal('time', curTime);
					if (keyCode != 32) {
						status = -1;
					}
				}
			} else if (isTrigger) {
				if ((status == (checkUseIns() ? -3 : -1)) && pressreadyId == undefined) {
					pressreadyId = setTimeout(pressReady, getProp('preTime'));
				} else if (status == -1 && checkUseIns()) {
					status = -4;
				}
			} else if (keyCode == 27 && status <= -1) { //inspection or ready to start, press ESC to reset
				clearPressReady();
				status = -1;
				lcd.val(0);
				ui.setAutoShow(true);
			}
			lcd.fixDisplay(true, isTrigger);
			if (isTrigger) {
				kernel.clrKey();
			}
		}

		function pressReady() {
			if (status == -1 || status == -3) {
				if (status == -1) {
					lcd.reset();
				}
				status = -2;
				pressreadyId = undefined;
				lcd.fixDisplay(true, true);
			}
		}

		function reset() {
			if (pressreadyId != undefined) {
				clearTimeout(pressreadyId);
				pressreadyId = undefined;
			}
			lastDown = lastStop = 0;
		}

		var ctrlStatus = 0x0;

		//type: 0 down, 1 up
		function detectTrigger(keyCode, type, e) {
			var prevStatus = ctrlStatus;
			if (keyCode > 255) {
				if (type) {
					ctrlStatus &= ~(1 << keyCode);
				} else {
					ctrlStatus |= (1 << keyCode);
				}
			} else if (!e.ctrlKey) {
				ctrlStatus = 0;
			}
			return keyCode == 32 || (prevStatus == 3 && keyCode > 255) || ctrlStatus == 3;
		}

		return {
			onkeydown: function(keyCode, e) {
				return onkeydown(keyCode, detectTrigger(keyCode, 0, e));
			},
			onkeyup: function(keyCode, e) {
				return onkeyup(keyCode, detectTrigger(keyCode, 1, e));
			},
			reset: reset
		}
	})();

	var inputTimer = (function() {
		var input = $('<textarea id="inputTimer" rows="1" />');
		var lastEmptyTrigger = 0;

		function parseInput() {
			//                          |1st     |2nd    |3rd    |4th        |5th        |6th              |7th                    |8th              |9th
			var reg = /^(?:[\d]+\. )?\(?(DNF)?\(?(\d*?):?(\d*?):?(\d*\.?\d*?)(\+)?\)?(?:=([\d:.+]+?))?(?:\[([^\]]+)\])?\)?\s*(?:   ([^@].*?))?(?:   @(.*?))?$/;
			var timeRe = /^(\d*?):?(\d*?):?(\d*\.?\d*?)$/;
			var arr = input.val();
			var now = $.now();
			if (/^[\s\n]*$/.exec(arr) && now > lastEmptyTrigger + 500) {
				kernel.pushSignal('ctrl', ['scramble', 'next']);
				lastEmptyTrigger = now;
				input.val('');
				return;
			}
			arr = arr.split(/\s*[,\n]\s*/);
			var time, ins, comment, scramble;
			for (var i = 0; i < arr.length; i++) {
				var m = reg.exec(arr[i]);
				if (m != null && m[4] != "") {
					time = Math.round(3600000 * Math.floor(m[2]) + 60000 * Math.floor(m[3]) + 1000 * parseFloat(m[4]));
					if (time == 0) {
						continue;
					}
					if (m[2] == '' && m[3] == '' && /^\d+$/.exec(m[4])) {
						var intUN = kernel.getProp('intUN') || 20100;
						var modUN = intUN % 10000;
						time = Math.floor(time / modUN);
						var hh = Math.floor(time / 10000000);
						var mi = Math.floor(time / 100000) % 100;
						var ss = time % 100000;
						if (intUN > 20000) {
							time = (60 * hh + mi) * 60000 + ss;
						} else if (intUN > 10000) {
							time = (100 * hh + mi) * 60000 + ss;
						}
					}
					if (m[1] == "DNF") {
						ins = -1;
					} else if (m[5] == "+" && time > 2000) {
						ins = 2000;
						time -= 2000;
					} else {
						ins = 0;
					}
					var timeSplit = [];
					if (m[6]) { //multi-phase timing
						timeSplit = m[6].split('+').reverse();
						var timeRemain = time;
						for (var j = 0; j < timeSplit.length; j++) {
							var mt = timeRe.exec(timeSplit[j]);
							if (mt == null) {
								timeRemain = 1e8;
								break;
							}
							timeRemain -= Math.round(3600000 * Math.floor(mt[1]) + 60000 * Math.floor(mt[2]) + 1000 * parseFloat(mt[3]));
							timeSplit[j] = Math.max(0, timeRemain);
						}
						if (Math.abs(timeRemain) > 10 * timeSplit.length) {
							timeSplit = [];
						} else {
							timeSplit.pop();
						}
					}
					comment = m[7] || "";
					scramble = m[8];
					//TODO timestamp = m[9]
					curTime = [comment, scramble, [ins, time].concat(timeSplit)];
					var timestamp = mathlib.str2time(m[9]);
					if (timestamp) {
						curTime.push(timestamp);
					}
					pushSignal('time', curTime);
					kernel.clrKey();
				}
			}
			input.val('');
		}

		function setEnable(enable) {
			enable ? input.show() : input.hide();
			if (enable) {
				fobj = input;
				input[0].select();
				input.unbind("click").click(function() {
					input[0].select();
				});
			} else {
				fobj = undefined;
			}
		}

		$(function() {
			$('#lcd').after(input);
		});

		return {
			setEnable: setEnable,
			parseInput: parseInput,
			clear: function() {
				input.val('');
			}
		}
	})();

	var stackmatTimer = (function() {
		var enable = false;
		var lastState = {};
		var inspectionTime;

		function stackmatCallback(state) {
			if (!enable) {
				return;
			}
			var now = $.now();
			if (!state.on) {
				status = -1;
				lcd.val();
				lcd.setRunning(false);
				lcd.color('');
				ui.setAutoShow(true);
				lastState = state;
				return;
			}
			var curTime = state.time_milli;
			if (state.running) {
				if (status == -3 || status == -4) {
					inspectionTime = now - startTime - curTime;
					lcd.reset();
				}
				status = 1;
				startTime = now - curTime;
				ui.setAutoShow(false);
			} else if (status == -1 && checkUseIns() && curTime == 0 && (state.rightHand || state.leftHand)) {
				status = -3;
				ui.setAutoShow(false);
				startTime = now;
			} else if (status != -3 && status != -4) {
				status = -1;
				lcd.val(curTime);
				ui.setAutoShow(true);
			}
			if (lastState.running && !state.running && state.time_milli != 0) {
				inspectionTime = checkUseIns() ? inspectionTime > 17000 ? -1 : (inspectionTime > 15000 ? 2000 : 0) : 0;
				pushSignal('time', [inspectionTime, ~~curTime]);
			}
			timerDisplay(state);
			lastState = state;
		}

		function timerDisplay(state) {
			if (state.greenLight) {
				lcd.color('#0d0');
			} else if (state.rightHand && state.leftHand) {
				lcd.color('#f00');
			} else if (status == -4) {
				lcd.color('#0d0');
			} else {
				lcd.color('');
			}
			lcd.setRunning(status == -3 || (state.running && state.signalHeader != 67));
		}

		function onkeyup(keyCode) {
			var now = $.now();
			if (keyCode == 32 && status == -4) {
				status = -3;
				lcd.reset();
				startTime = now;
				lcd.fixDisplay(false, keyCode == 32);
			}
			if (keyCode == 32) {
				kernel.clrKey();
			}
		}

		function onkeydown(keyCode) {
			var now = $.now();

			if (keyCode == 32 && status == -1 && checkUseIns() && lastState.on && lastState.time_milli == 0) {
				status = -4;
				startTime = now;
				lcd.fixDisplay(true, true);
			} else if (keyCode == 27 && status <= -1) { //inspection or ready to start, press ESC to reset
				status = -1;
				lcd.val(0);
				lcd.fixDisplay(true, false);
			}
			if (keyCode == 32) {
				kernel.clrKey();
			}
		}

		return {
			setEnable: function(input) { //s: stackmat, m: moyu
				enable = input == 's' || input == 'm';
				if (enable) {
					stackmatutil.setCallBack(stackmatCallback);
					stackmatutil.init(input, false).then($.noop, function() {
						kernel.showDialog([$('<div>Press OK To Connect To Stackmat</div>'), function() {
							stackmatutil.init(input, true).then($.noop, console.log);
						}, 0, 0], 'share', 'Stackmat Connect');
					});
				} else {
					stackmatutil.stop();
				}
			},
			onkeyup: onkeyup,
			onkeydown: onkeydown
		}
	})();

	function col2std(col, faceMap) {
		var ret = [];
		col = (col || '').match(/#[0-9a-fA-F]{3}/g) || [];
		for (var i = 0; i < col.length; i++) {
			ret.push(~~(kernel.ui.nearColor(col[faceMap[i]], 0, true).replace('#', '0x')));
		}
		return ret;
	}

	var puzzleFactory = (function() {
		var isLoading = false;

		var twistyScene;
		var twisty;
		var qcubeObj;
		var puzzle = {
			keydown: function(args) {
				return twistyScene.keydown(args);
			},
			resize: function() {
				return twistyScene.resize();
			},
			addMoves: function(args) {
				return twistyScene.addMoves(args);
			},
			applyMoves: function(args) {
				return twistyScene.applyMoves(args);
			},
			isRotation: function(move) {
				return twisty.isInspectionLegalMove(twisty, move);
			},
			move2str: function(move) {
				return twisty.move2str(move);
			},
			toggleColorVisible: function(args) {
				return twisty.toggleColorVisible(twisty, args);
			},
			isSolved: function(args) {
				return twisty.isSolved(twisty, args);
			},
			moveCnt: function(clr) {
				return twisty.moveCnt(clr);
			},
			parseScramble: function(scramble) {
				return twisty.parseScramble(scramble);
			}
		};

		function init(options, moveListener, parent, callback) {
			if (window.twistyjs == undefined) {
				if (!isLoading && document.createElement('canvas').getContext) {
					isLoading = true;
					$.getScript("js/twisty.js", init.bind(null, options, moveListener, parent, callback));
				} else {
					callback(undefined, true);
				}
				return;
			}
			if (getProp('input') != 'q') {
				var isInit = twistyScene == undefined;
				if (isInit) {
					twistyScene = new twistyjs.TwistyScene();
					twistyScene.addMoveListener(moveListener);
					parent.empty().append(twistyScene.getDomElement());
					qcubeObj = null;
				}
				twistyScene.initializeTwisty(options);
				twisty = twistyScene.getTwisty();
				callback(puzzle, isInit);
			} else {
				var isInit = qcubeObj == undefined;
				if (isInit) {
					qcubeObj = twistyjs.qcube;
					qcubeObj.addMoveListener(moveListener);
					parent.empty().append(qcubeObj.getDomElement());
					qcubeObj.resize();
					twistyScene = null;
				}
				qcubeObj.init(options);
				callback(qcubeObj, isInit);
			}
		}

		return {
			init: init
		}
	})();

	var virtual333 = (function() {
		var puzzleObj;
		var vrcType = '';
		var insTime = 0;
		var moveCnt = 0;
		var totPhases = 1;

		//mstep: 0 move start, 1 move doing, 2 move finish
		function moveListener(move, mstep) {
			if (mstep == 1) {
				return;
			}
			var now = $.now();
			if (status == -3 || status == -2) {
				if (puzzleObj.isRotation(move) && !/^(333ni|444bld|555bld)$/.exec(curScrType)) {
					if (mstep == 0) {
						rawMoves[0].push([puzzleObj.move2str(move), 0]);
					}
					return;
				} else {
					if (checkUseIns()) {
						insTime = now - startTime;
					} else {
						insTime = 0;
					}
					startTime = now;
					moveCnt = 0;
					status = curScrSize == 3 && curScrType != "r3" ? nPhases[getProp('vrcMP', 'n')] : 1;
					var inspectionMoves = rawMoves[0];
					rawMoves = [];
					for (var i = 0; i < status; i++) {
						rawMoves[i] = [];
					}
					rawMoves[status] = inspectionMoves;
					totPhases = status;
					curTime = [insTime > 17000 ? -1 : (insTime > 15000 ? 2000 : 0)];
					lcd.setRunning(true, true);
					ui.setAutoShow(false);
				}
			}
			if (status >= 1) {
				if (/^(333ni|444bld|555bld)$/.exec(curScrType) && !puzzleObj.isRotation(move)) {
					puzzleObj.toggleColorVisible(puzzleObj.isSolved(getProp('vrcMP', 'n')) == 0);
				}
				if (mstep == 0) {
					rawMoves[status - 1].push([puzzleObj.move2str(move), now - startTime]);
				}
				if (mstep == 2) {
					var curProgress = puzzleObj.isSolved(getProp('vrcMP', 'n'));
					if (curProgress < status) {
						for (var i = status; i > curProgress; i--) {
							curTime[i] = now - startTime;
						}
					}
					status = Math.min(curProgress, status) || 1;
					if (totPhases > 1) {
						lcd.setStaticAppend(lcd.getMulPhaseAppend(status, totPhases));
					}
				}
				if (curProgress == 0 && mstep == 2) {
					moveCnt += puzzleObj.moveCnt();
					if (curScrType.match(/^r\d+$/) && curScramble.length != 0) {
						if (curScrType != "r3") {
							curScrSize++;
						}
						reset(true);
						scrambleIt();
						return;
					}
					ui.setAutoShow(true);
					status = -1;
					lcd.setRunning(false);
					lcd.setStaticAppend('');
					lcd.val(curTime[1], true);
					lcd.append(lcd.getMulPhaseAppend(0, totPhases));
					lcd.append(
						'<div style="font-family: Arial; font-size: 0.5em">' + moveCnt + " moves<br>" + ~~(100000 * moveCnt / curTime[1]) / 100.0 + " tps" + "</div>");
					rawMoves.reverse();
					pushSignal('time', ["", 0, curTime, 0, [$.map(rawMoves, cubeutil.moveSeq2str).join(' ')]]);
				}
			}
		}

		function reset(temp) {
			if (isReseted && getProp('input') == vrcType || !isEnable) {
				return;
			}
			isReseted = true;
			vrcType = getProp('input');
			var size = curScrSize;
			if (!size) {
				size = 3;
			}
			var options = {
				type: "cube",
				faceColors: col2std(kernel.getProp('colcube'), [3, 4, 5, 0, 1, 2]), // U L F D L B
				dimension: size,
				stickerWidth: 1.7,
				scale: 0.9
			};
			if (curPuzzle == 'skb') {
				options = {
					type: "skewb",
					faceColors: col2std(kernel.getProp('colskb'), [0, 5, 4, 2, 1, 3]),
					scale: 0.9
				};
			} else if (curPuzzle == 'mgm') {
				options = {
					type: "mgm",
					faceColors: col2std(kernel.getProp('colmgm'), [0, 2, 1, 5, 4, 3, 11, 9, 8, 7, 6, 10]),
					scale: 0.9
				};
			} else if (curPuzzle == 'pyr') {
				options = {
					type: "pyr",
					faceColors: col2std(kernel.getProp('colpyr'), [3, 1, 2, 0]),
					scale: 0.9
				};
			} else if (curPuzzle == 'sq1') {
				options = {
					type: "sq1",
					faceColors: col2std(kernel.getProp('colsq1'), [0, 5, 4, 2, 1, 3]),
					scale: 0.9
				};
			}

			puzzleFactory.init(options, moveListener, div, function(ret, isInit) {
				puzzleObj = ret;
				if (isInit && !puzzleObj) {
					div.css('height', '');
					div.html('--:--');
				}
				if (!temp) {
					lcd.setRunning(false, true);
					lcd.setStaticAppend('');
					setSize(getProp('timerSize'));
				}
			});
		}


		function scrambleIt() {
			reset();
			var scramble = curScramble;
			if (curScrType.match(/^r\d+$/)) {
				scramble = curScramble.shift().match(/\d+\) (.*)$/)[1];
				lcd.setStaticAppend("<br>" + (curScramble.length + 1) + "/" + curScramble.len);
			}
			scramble = puzzleObj.parseScramble(scramble);
			isReseted = false;

			puzzleObj.applyMoves(scramble);
			puzzleObj.moveCnt(true);
			rawMoves = [
				[]
			];
		}

		function onkeydown(keyCode) {
			if (puzzleObj == undefined) {
				return;
			}
			var now = $.now();
			if (status == -1) { // idle
				if (keyCode == 32) {
					scrambleIt();
					if (checkUseIns()) {
						status = -3; //inspection
						startTime = now;
						lcd.setRunning(true, true);
					} else {
						lcd.setRunning(false, true);
						lcd.val(0, true);
						status = -2; //ready
					}
					ui.setAutoShow(false);
				}
			} else if (status == -3 || status == -2 || status >= 1) { // Scrambled or Running
				if (keyCode == 27) { //ESC
					ui.setAutoShow(true);
					if (status >= 1) {
						pushSignal('time', ["", 0, [-1, now - startTime], 0, [$.map(rawMoves, cubeutil.moveSeq2str).join(' ')]]);
					}
					reset();
					status = -1;
				} else {
					var a = {
						keyCode: keyCode
					};
					puzzleObj.keydown(a);
				}
			}
			if (keyCode == 27 || keyCode == 32) {
				kernel.clrKey();
			}
		}

		var curScramble;
		var curScrType;
		var curScrSize;
		var curPuzzle;
		var types = ['', 'sq1', '222', '333', '444', '555', '666', '777', '888', '999', '101010', '111111', 'skb', 'mgm', 'pyr'];
		var isReseted = false;

		function procSignal(signal, value) {
			if (signal == 'scramble') {
				curScrType = value[0];
				curScramble = value[1];
				var puzzle = tools.puzzleType(curScrType);
				var size = types.indexOf(puzzle);
				if (puzzle == 'cubennn') {
					size = value[2];
				}
				if (size != -1 && (curScrSize != size || curPuzzle != puzzle)) {
					curScrSize = size;
					curPuzzle = puzzle;
					isReseted = false;
					reset();
				}
				var m = value[0].match(/^r(\d)\d*$/);
				if (m) {
					curScramble = curScramble.split('\n');
					curScramble.len = curScramble.length;
					if (curScrSize != ~~m[1]) {
						curScrSize = ~~m[1];
						isReseted = false;
						reset();
					}
				}
			}
		}

		var div = $('<div />');
		var isEnable = false;

		function setEnable(enable) {
			isEnable = enable;
			enable ? div.show() : div.hide();
		}

		function setSize(value) {
			div.css('height', value * $('#logo').width() / 9 + 'px');
			puzzleObj && puzzleObj.resize();
		}

		$(function() {
			regListener('timer', 'scramble', procSignal);
			div.appendTo("#container");
		});
		return {
			onkeydown: onkeydown,
			setEnable: setEnable,
			setSize: setSize,
			reset: reset
		}
	})();


	var giikerTimer = (function() {

		var enable = false;
		var enableVRC = false;
		var waitReadyTid = 0;
		var moveReadyTid = 0;
		var insTime = 0;
		var div = $('<div />');
		var totPhases = 1;
		var currentFacelet = mathlib.SOLVED_FACELET;

		var giikerVRC = (function() {
			var twistyScene;
			var twisty;
			var isReseted = false;
			var isLoading = false;
			var curVRCCubie = new mathlib.CubieCube();
			var tmpCubie1 = new mathlib.CubieCube();
			var tmpCubie2 = new mathlib.CubieCube();

			function resetVRC(temp) {
				if (twistyScene == undefined || isReseted || !enableVRC) {
					return;
				}
				isReseted = true;
				twistyScene.initializeTwisty({
					type: "cube",
					faceColors: col2std(kernel.getProp('colcube'), [3, 4, 5, 0, 1, 2]), // U L F D L B
					dimension: 3,
					stickerWidth: 1.7,
					scale: 0.9
				});
				curVRCCubie.fromFacelet(mathlib.SOLVED_FACELET);
				twisty = twistyScene.getTwisty();
				if (!temp) {
					setSize(getProp('timerSize'));
				}
			}

			function setSize(value) {
				div.css('height', value * $('#logo').width() / 9 + 'px');
				twistyScene && twistyScene.resize();
			}

			function initVRC() {
				if (twistyScene != undefined) {} else if (window.twistyjs != undefined) {
					twistyScene = new twistyjs.TwistyScene();
					div.empty().append(twistyScene.getDomElement());
					resetVRC();
					twistyScene.resize();
					isLoading = false;
				} else if (!isLoading && document.createElement('canvas').getContext) {
					$.getScript("js/twisty.js", initVRC);
					isLoading = true;
				} else {
					div.css('height', '');
					div.html('--:--');
				}
			}

			function setState(state, prevMoves, isFast) {
				tmpCubie1.fromFacelet(state);
				var todoMoves = [];
				var shouldReset = true;
				for (var i = 0; i < prevMoves.length; i++) {
					todoMoves.push(prevMoves[i]);
					var m = "URFDLB".indexOf(prevMoves[i][0]) * 3 + "'2 ".indexOf(prevMoves[i][1]);
					if (!(m >= 0 && m < 18)) {
						continue;
					}
					mathlib.CubieCube.EdgeMult(tmpCubie1, mathlib.CubieCube.moveCube[m], tmpCubie2);
					mathlib.CubieCube.CornMult(tmpCubie1, mathlib.CubieCube.moveCube[m], tmpCubie2);
					var tmp = tmpCubie1;
					tmpCubie1 = tmpCubie2;
					tmpCubie2 = tmp;
					if (tmpCubie1.isEqual(curVRCCubie)) {
						shouldReset = false;
						break;
					}
				}
				if (shouldReset) { //cannot get current state according to prevMoves
					resetVRC(false);
					curVRCCubie.fromFacelet(mathlib.SOLVED_FACELET);
					todoMoves = scramble_333.genFacelet(state);
				} else {
					todoMoves = todoMoves.reverse().join(' ');
				}
				var scramble;
				if (todoMoves.match(/^\s*$/)) {
					scramble = [];
				} else {
					scramble = twisty.parseScramble(todoMoves);
				}
				if (scramble.length < 5) {
					twistyScene.addMoves(scramble);
				} else {
					twistyScene.applyMoves(scramble);
				}
				isReseted = false;
				curVRCCubie.fromFacelet(state);
			}

			return {
				resetVRC: resetVRC, //reset to solved
				initVRC: initVRC,
				setState: setState,
				setSize: setSize
			}
		})();

		function clearReadyTid() {
			if (waitReadyTid) {
				clearTimeout(waitReadyTid);
				waitReadyTid = 0;
			}
			if (moveReadyTid) {
				clearTimeout(moveReadyTid);
				moveReadyTid = 0;
			}
		}

		function giikerCallback(facelet, prevMoves, now) {
			currentFacelet = facelet;
			if (!enable) {
				return;
			}
			if (enableVRC) {
				giikerVRC.setState(facelet, prevMoves, false);
			}
			clearReadyTid();
			if (status == -1) {
				if (facelet != mathlib.SOLVED_FACELET) {
					var delayStart = getProp('giiSD');
					if (delayStart == 's') {
						//according to scramble
						if (giikerutil.checkScramble()) {
							markScrambled(now);
						}
					} else if (delayStart != 'n') {
						waitReadyTid = setTimeout(function() {
							markScrambled(now);
						}, ~~delayStart * 1000);
					}
					var moveStart = getProp('giiSM');
					if (moveStart != 'n') {
						var movere = {
							'x4': /^([URFDLB][ '])\1\1\1$/,
							'xi2': /^([URFDLB])( \1'\1 \1'|'\1 \1'\1 )$/
						} [moveStart];
						if (movere.exec(prevMoves.join(''))) {
							moveReadyTid = setTimeout(function() {
								markScrambled(now);
							}, 1000);
						}
					}
				}
			} else if (status == -3 || status == -2) {
				if (checkUseIns()) {
					insTime = now - startTime;
				} else {
					insTime = 0;
				}
				startTime = now;
				status = nPhases[getProp('vrcMP', 'n')];
				rawMoves = [];
				for (var i = 0; i < status; i++) {
					rawMoves[i] = [];
				}
				totPhases = status;
				curTime = [insTime > 17000 ? -1 : (insTime > 15000 ? 2000 : 0)];
				lcd.fixDisplay(false, true);
				lcd.setRunning(true, enableVRC);
				ui.setAutoShow(false);
			}
			if (status >= 1) {
				rawMoves[status - 1].push([prevMoves[0], now - startTime]);

				var curProgress = cubeutil.getProgress(facelet, kernel.getProp('vrcMP', 'n'));
				if (curProgress < status) {
					for (var i = status; i > curProgress; i--) {
						curTime[i] = now - startTime;
					}
				}
				status = Math.min(curProgress, status) || 1;
				lcd.setStaticAppend(lcd.getMulPhaseAppend(status, totPhases));
				if (facelet == mathlib.SOLVED_FACELET) {
					rawMoves.reverse();
					var prettyMoves = cubeutil.getPrettyMoves(rawMoves);
					var solve = "";
					var stepName = phaseNames[kernel.getProp('vrcMP', 'n')];
					var moveCnt = 0;
					for (var i = 0; i < prettyMoves.length; i++) {
						moveCnt += prettyMoves[i][1];
						solve += prettyMoves[i][0] + (stepName[i] ? " //" + stepName[i] + " " + prettyMoves[i][1] + " move(s)%0A" : "")
					}
					giikerutil.setLastSolve(solve);
					status = -1;
					curTime[1] = now - startTime;
					ui.setAutoShow(true);
					lcd.setRunning(false, enableVRC);
					lcd.setStaticAppend('');
					lcd.fixDisplay(false, true);
					lcd.val(curTime[1], enableVRC);
					lcd.append(lcd.getMulPhaseAppend(0, totPhases));
					lcd.append('<div style="font-family: Arial; font-size: 0.5em">' + moveCnt + " moves<br>" + ~~(100000 * moveCnt / curTime[1]) / 100.0 + " tps" + "</div>");

					if (curTime[1] != 0) {
						var ext = [$.map(rawMoves, cubeutil.moveSeq2str).join(' ')];
						ext[prettyMoves.length] = prettyMoves[0][1];
						for (var i = 1; i < prettyMoves.length; i++) {
							ext[prettyMoves.length - i] = ext[prettyMoves.length - i + 1] + prettyMoves[i][1];
						}
						pushSignal('time', ["", 0, curTime, 0, ext]);
					}
				}
			}
		}

		function markScrambled(now) {
			clearReadyTid();
			if (status == -1) {
				giikerutil.markScrambled();
				if (!giikerutil.checkScramble()) {
					pushSignal('scramble', ['333', scramble_333.genFacelet(currentFacelet), 0]);
				}
				status = -2;
				startTime = now;
				lcd.fixDisplay(true, true);
				if (checkUseIns()) {
					lcd.setRunning(true, enableVRC);
				}
				ui.setAutoShow(false);
				if (getProp('giiBS')) {
					metronome.playTick();
				}
			}
		}

		function setVRC(enable) {
			enableVRC = enable;
			enable ? div.show() : div.hide();
			if (enable) {
				giikerVRC.initVRC();
			}
		}

		$(function() {
			div.appendTo("#container");
		});

		return {
			setEnable: function(input) { //s: stackmat, m: moyu
				enable = input == 'g';
				if (enable) {
					giikerutil.setCallBack(giikerCallback);
					var ret = giikerutil.init();
					if (ret) {
						ret.then($.noop, function(error) {
							if (error.code == error.SECURITY_ERR) {
								kernel.showDialog([$('<div>Press OK To Connect To Giiker Cube</div>'), function() {
									giikerutil.init().then($.noop, console.log);
								}, 0, 0], 'share', 'Giiker Connect');
							}
						});
					}
				} else {
					GiikerCube.stop();
				}
				setVRC(enable && getProp('giiVRC'));
			},
			onkeydown: function(keyCode) {
				if (keyCode == 27) {
					clearReadyTid();
					status = -1;
					ui.setAutoShow(true);
					lcd.val(0, enableVRC);
					lcd.setRunning(false, enableVRC);
					lcd.fixDisplay(false, true);
				} else if (keyCode == 32 && getProp('giiSK') && currentFacelet != mathlib.SOLVED_FACELET) {
					if (status == -1) {
						markScrambled($.now());
					}
				}
			},
			setVRC: setVRC,
			setSize: giikerVRC.setSize
		}
	})();

	function getKeyCode(e) {
		// left Ctrl: 256
		// right Ctrl: 257

		var keyCode = e.which;
		if (keyCode == 17) { // ctrl
			var origE = e.originalEvent;
			if (origE.location == 1 || origE.keyLocation == 1) {
				keyCode = 256;
			} else if (origE.location == 2 || origE.keyLocation == 2) {
				keyCode = 257;
			}
		}
		return keyCode;
	}

	function onkeydown(e) {
		if (ui.isPop()) {
			return;
		}
		var keyCode = getKeyCode(e);
		var focusObj = $(document.activeElement);
		if (focusObj.is('input, textarea, select')) {
			if (getProp('input') == 'i' && focusObj.prop('id') == 'inputTimer' && keyCode == 13) {
				inputTimer.parseInput();
			}
			return;
		} else {
			focusObj.blur();
		}
		switch (getProp('input')) {
			case 't':
				keyboardTimer.onkeydown(keyCode, e);
				break;
			case 's':
				stackmatTimer.onkeydown(keyCode, e);
			case 'i':
				break;
			case 'v':
			case 'q':
				virtual333.onkeydown(keyCode, e);
				break;
			case 'g':
				giikerTimer.onkeydown(keyCode, e);
				break;
		}
	}

	function onkeyup(e) {
		if (ui.isPop()) {
			return;
		}
		var keyCode = getKeyCode(e);
		var focusObj = $(document.activeElement);
		if (focusObj.is('input, textarea, select')) {
			if (getProp('input') == 'i' && focusObj.prop('id') == 'inputTimer' && keyCode == 13) {
				inputTimer.clear();
			}
			return;
		} else {
			focusObj.blur();
		}
		switch (getProp('input')) {
			case 't':
				keyboardTimer.onkeyup(keyCode, e);
				break;
			case 's':
				stackmatTimer.onkeyup(keyCode, e);
				break;
		}
	}

	var resetCondition = "input|phases|preScr|useMilli|smallADP|giiVRC".split('|');

	$(function() {
		container = $('#container');
		regListener('timer', 'property', function(signal, value) {
			if (value[0] == 'timerSize') {
				container.css('font-size', value[1] + 'em');
				virtual333.setSize(value[1]);
				giikerTimer.setSize(value[1]);
			}
			if (value[0] == 'timerSize' || value[0] == 'phases') {
				$('#multiphase').css('font-size', getProp('timerSize') / Math.max(getProp('phases'), 4) + 'em')
			}
			if (value[0] == 'input') {
				stackmatTimer.setEnable(value[1]);
				giikerTimer.setEnable(value[1]);
			}
			if (value[0] == 'showAvg') {
				avgDiv.showAvgDiv(value[1]);
			}
			if (value[0] == 'giiVRC' && value[2] != 'set') {
				giikerTimer.setEnable(getProp('input'));
			}
			if ($.inArray(value[0], resetCondition) != -1) {
				reset();
			}
		}, /^(?:input|phases|scrType|preScr|timerSize|showAvg|useMilli|smallADP|giiVRC)$/);
		regProp('vrc', 'vrcSpeed', 1, PROPERTY_VRCSPEED, [100, [0, 50, 100, 200, 500, 1000], '\u221E|20|10|5|2|1'.split('|')], 1);
		regProp('vrc', 'vrcMP', 1, PROPERTY_VRCMP, ['n', ['n', 'cfop', 'fp', 'cf4op', 'cf4o2p2', 'roux'], PROPERTY_VRCMPS.split('|')], 1);
		regProp('vrc', 'vrcAH', 1, 'Useless pieces in huge cube', ['01', ['00', '01', '10', '11'], ['Hide', 'Border', 'Color', 'Show']], 1);
		regProp('vrc', 'giiVRC', 0, PROPERTY_GIIKERVRC, [true], 1);
		regProp('vrc', 'giiSD', 1, PROPERTY_GIISOK_DELAY, ['s', ['2', '3', '4', '5', 'n', 's'], PROPERTY_GIISOK_DELAYS.split('|')], 1);
		regProp('vrc', 'giiSK', 0, PROPERTY_GIISOK_KEY, [true], 1);
		regProp('vrc', 'giiSM', 1, PROPERTY_GIISOK_MOVE, ['n', ['x4', 'xi2', 'n'], PROPERTY_GIISOK_MOVES.split('|')], 1);
		regProp('vrc', 'giiBS', 0, PROPERTY_GIISBEEP, [true], 1);
		regProp('vrc', 'giiRST', 1, PROPERTY_GIIRST, ['p', ['a', 'p', 'n'], PROPERTY_GIIRSTS.split('|')]);
		regProp('vrc', 'giiAED', 0, PROPERTY_GIIAED, [false]);
		regProp('timer', 'useMouse', 0, PROPERTY_USEMOUSE, [false], 1);
		regProp('timer', 'useIns', 1, PROPERTY_USEINS, ['n', ['a', 'b', 'n'], PROPERTY_USEINS_STR.split('|')], 1);
		regProp('timer', 'input', 1, PROPERTY_ENTERING, ['t', ['t', 'i', 's', 'm', 'v', 'g', 'q'], PROPERTY_ENTERING_STR.split('|')], 1);
		regProp('timer', 'intUN', 1, PROPERTY_INTUNIT, [20100, [1, 100, 1000, 10001, 10100, 11000, 20001, 20100, 21000], 'X|X.XX|X.XXX|X:XX|X:XX.XX|X:XX.XXX|X:XX:XX|X:XX:XX.XX|X:XX:XX.XXX'.split('|')], 1);
		regProp('timer', 'timeU', 1, PROPERTY_TIMEU, ['c', ['u', 'c', 's', 'i', 'n'], PROPERTY_TIMEU_STR.split('|')], 1);
		regProp('timer', 'preTime', 1, PROPERTY_PRETIME, [300, [0, 300, 550, 1000], '0|0.3|0.55|1'.split('|')], 1);
		regProp('timer', 'phases', 2, PROPERTY_PHASES, [1, 1, 10], 3);
		regProp('kernel', 'showAvg', 0, SHOW_AVG_LABEL, [true], 1);
		regProp('ui', 'timerSize', 2, PROPERTY_TIMERSIZE, [20, 1, 100], 1);
		regProp('ui', 'smallADP', 0, PROPERTY_SMALLADP, [true], 1);
	});

	var fobj;

	function refocus() {
		if (fobj != undefined) {
			fobj.focus();
		} else {
			document.activeElement && document.activeElement.blur && document.activeElement.blur();
		}
	}

	return {
		onkeydown: onkeydown,
		onkeyup: onkeyup,
		showAvgDiv: avgDiv.showAvgDiv,
		refocus: refocus,
		getCurTime: function(now) {
			return status > 0 ? (now || $.now()) - startTime : 0;
		}
	};
}, [kernel.regListener, kernel.regProp, kernel.getProp, kernel.pretty, kernel.ui, kernel.pushSignal]);
