// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Test} from "forge-std/Test.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import {SavingsJar} from "../SavingsJar.sol";

contract MockUSDC is ERC20 {
    constructor() ERC20("Mock USDC", "mUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract SavingsJarTest is Test {
    event JarCreated(uint256 indexed jarId, address indexed owner, string name, uint64 unlockTime);
    event Deposited(uint256 indexed jarId, address indexed owner, uint256 amount, uint256 newBalance);
    event Withdrawn(uint256 indexed jarId, address indexed owner, uint256 amount, uint256 newBalance);

    SavingsJar internal jar;
    MockUSDC internal usdc;
    address internal alice = makeAddr("alice");
    address internal bob = makeAddr("bob");

    uint256 internal constant FUNDS = 1_000_000e6;
    uint64 internal unlockAt;

    function setUp() public {
        vm.warp(1_000_000);
        usdc = new MockUSDC();
        jar = new SavingsJar(IERC20(address(usdc)));
        usdc.mint(alice, FUNDS);
        usdc.mint(bob, FUNDS);
        vm.prank(alice);
        usdc.approve(address(jar), type(uint256).max);
        vm.prank(bob);
        usdc.approve(address(jar), type(uint256).max);
        unlockAt = uint64(block.timestamp + 1 days);
    }

    // ---------- helpers ----------
    function _create(address who) internal returns (uint256 id) {
        vm.prank(who);
        id = jar.createJar("Holiday", unlockAt);
    }

    function _deposit(address who, uint256 id, uint256 amt) internal {
        vm.prank(who);
        jar.deposit(id, amt);
    }

    // ---------- constructor ----------
    function test_Constructor_SetsToken() public view {
        assertEq(address(jar.usdc()), address(usdc));
        assertEq(jar.jarCount(), 0);
    }

    function test_RevertWhen_ConstructorZeroAddress() public {
        vm.expectRevert(SavingsJar.ZeroAddress.selector);
        new SavingsJar(IERC20(address(0)));
    }

    // ---------- createJar ----------
    function test_CreateJar_HappyPath() public {
        uint256 id = _create(alice);
        assertEq(id, 0);
        assertEq(jar.jarCount(), 1);
        (address o, string memory n, uint64 u, uint256 b, bool unlocked) = jar.getJar(id);
        assertEq(o, alice);
        assertEq(n, "Holiday");
        assertEq(u, unlockAt);
        assertEq(b, 0);
        assertFalse(unlocked);
    }

    function test_CreateJar_IdsIncrementAcrossUsers() public {
        assertEq(_create(alice), 0);
        assertEq(_create(bob), 1);
        assertEq(_create(alice), 2);
        assertEq(jar.jarCount(), 3);
    }

    function test_CreateJar_EmitsEvent() public {
        vm.expectEmit(true, true, false, true, address(jar));
        emit JarCreated(0, alice, "Holiday", unlockAt);
        _create(alice);
    }

    function test_CreateJar_NameLengthBoundaries() public {
        bytes memory max = new bytes(64);
        for (uint256 i; i < 64; i++) {
            max[i] = "a";
        }
        vm.prank(alice);
        jar.createJar(string(max), unlockAt); // 64 ok
        vm.prank(alice);
        jar.createJar("x", unlockAt); // 1 ok
        assertEq(jar.jarCount(), 2);
    }

    function test_RevertWhen_CreateJarEmptyName() public {
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InvalidName.selector);
        jar.createJar("", unlockAt);
    }

    function test_RevertWhen_CreateJarNameTooLong() public {
        bytes memory long = new bytes(65);
        for (uint256 i; i < 65; i++) {
            long[i] = "a";
        }
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InvalidName.selector);
        jar.createJar(string(long), unlockAt);
    }

    function test_RevertWhen_CreateJarUnlockInPast() public {
        vm.prank(alice);
        vm.expectRevert(SavingsJar.UnlockTimeNotInFuture.selector);
        jar.createJar("Past", uint64(block.timestamp - 1));
    }

    function test_RevertWhen_CreateJarUnlockEqualsNow() public {
        vm.prank(alice);
        vm.expectRevert(SavingsJar.UnlockTimeNotInFuture.selector);
        jar.createJar("Now", uint64(block.timestamp));
    }

    // ---------- deposit ----------
    function test_Deposit_HappyPath() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        (,,, uint256 b,) = jar.getJar(id);
        assertEq(b, 100e6);
        assertEq(usdc.balanceOf(address(jar)), 100e6);
        assertEq(usdc.balanceOf(alice), FUNDS - 100e6);
    }

    function test_Deposit_EmitsEvent() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 40e6);
        vm.expectEmit(true, true, false, true, address(jar));
        emit Deposited(id, alice, 60e6, 100e6);
        _deposit(alice, id, 60e6);
    }

    function test_Deposit_AllowedAfterUnlock() public {
        uint256 id = _create(alice);
        skip(2 days);
        _deposit(alice, id, 5e6);
        (,,, uint256 b, bool unlocked) = jar.getJar(id);
        assertEq(b, 5e6);
        assertTrue(unlocked);
    }

    function test_RevertWhen_DepositNotOwner() public {
        uint256 id = _create(alice);
        vm.prank(bob);
        vm.expectRevert(SavingsJar.NotJarOwner.selector);
        jar.deposit(id, 1e6);
    }

    function test_RevertWhen_DepositZero() public {
        uint256 id = _create(alice);
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InvalidAmount.selector);
        jar.deposit(id, 0);
    }

    function test_RevertWhen_DepositNonexistentJar() public {
        vm.prank(alice);
        vm.expectRevert(SavingsJar.JarNotFound.selector);
        jar.deposit(0, 1e6);
    }

    function test_RevertWhen_DepositWithoutAllowance() public {
        address carol = makeAddr("carol");
        usdc.mint(carol, 10e6);
        vm.startPrank(carol);
        uint256 id = jar.createJar("c", unlockAt);
        vm.expectRevert();
        jar.deposit(id, 1e6);
        vm.stopPrank();
    }

    // ---------- withdraw ----------
    function test_Withdraw_HappyPartial() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.prank(alice);
        jar.withdraw(id, 30e6);
        (,,, uint256 b,) = jar.getJar(id);
        assertEq(b, 70e6);
        assertEq(usdc.balanceOf(alice), FUNDS - 70e6);
        assertEq(usdc.balanceOf(address(jar)), 70e6);
    }

    function test_Withdraw_EmitsEvent() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.expectEmit(true, true, false, true, address(jar));
        emit Withdrawn(id, alice, 30e6, 70e6);
        vm.prank(alice);
        jar.withdraw(id, 30e6);
    }

    function test_Withdraw_ExactBalance() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.prank(alice);
        jar.withdraw(id, 100e6);
        (,,, uint256 b,) = jar.getJar(id);
        assertEq(b, 0);
    }

    function test_RevertWhen_WithdrawBeforeUnlock() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days - 1);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SavingsJar.StillLocked.selector, unlockAt));
        jar.withdraw(id, 1e6);
    }

    function test_RevertWhen_WithdrawNotOwner() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.prank(bob);
        vm.expectRevert(SavingsJar.NotJarOwner.selector);
        jar.withdraw(id, 1e6);
    }

    function test_RevertWhen_WithdrawMoreThanBalance() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InsufficientBalance.selector);
        jar.withdraw(id, 100e6 + 1);
    }

    function test_RevertWhen_WithdrawZero() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InvalidAmount.selector);
        jar.withdraw(id, 0);
    }

    function test_RevertWhen_WithdrawNonexistentJar() public {
        vm.prank(alice);
        vm.expectRevert(SavingsJar.JarNotFound.selector);
        jar.withdraw(7, 1e6);
    }

    // ---------- withdrawAll ----------
    function test_WithdrawAll_HappyPath() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 100e6);
        skip(1 days);
        vm.expectEmit(true, true, false, true, address(jar));
        emit Withdrawn(id, alice, 100e6, 0);
        vm.prank(alice);
        jar.withdrawAll(id);
        (,,, uint256 b,) = jar.getJar(id);
        assertEq(b, 0);
        assertEq(usdc.balanceOf(alice), FUNDS);
        assertEq(usdc.balanceOf(address(jar)), 0);
    }

    function test_RevertWhen_WithdrawAllEmptyJar() public {
        uint256 id = _create(alice);
        skip(1 days);
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InvalidAmount.selector);
        jar.withdrawAll(id);
    }

    function test_RevertWhen_WithdrawAllLocked() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 1e6);
        vm.prank(alice);
        vm.expectRevert(abi.encodeWithSelector(SavingsJar.StillLocked.selector, unlockAt));
        jar.withdrawAll(id);
    }

    function test_RevertWhen_WithdrawAllNotOwner() public {
        uint256 id = _create(alice);
        _deposit(alice, id, 1e6);
        skip(1 days);
        vm.prank(bob);
        vm.expectRevert(SavingsJar.NotJarOwner.selector);
        jar.withdrawAll(id);
    }

    function test_RevertWhen_WithdrawAllNonexistent() public {
        vm.prank(alice);
        vm.expectRevert(SavingsJar.JarNotFound.selector);
        jar.withdrawAll(0);
    }

    // ---------- views ----------
    function test_GetJar_UnlockedAtExactUnlockTime() public {
        uint256 id = _create(alice);
        vm.warp(unlockAt);
        (,,,, bool unlocked) = jar.getJar(id);
        assertTrue(unlocked);
        assertEq(jar.timeRemaining(id), 0);
    }

    function test_RevertWhen_GetJarNonexistent() public {
        vm.expectRevert(SavingsJar.JarNotFound.selector);
        jar.getJar(0);
    }

    function test_TimeRemaining() public {
        uint256 id = _create(alice);
        assertEq(jar.timeRemaining(id), 1 days);
        skip(100);
        assertEq(jar.timeRemaining(id), 1 days - 100);
        skip(2 days);
        assertEq(jar.timeRemaining(id), 0);
    }

    function test_RevertWhen_TimeRemainingNonexistent() public {
        vm.expectRevert(SavingsJar.JarNotFound.selector);
        jar.timeRemaining(3);
    }

    function test_GetJarIdsByOwner() public {
        assertEq(jar.getJarIdsByOwner(alice).length, 0);
        _create(alice);
        _create(bob);
        _create(alice);
        uint256[] memory ids = jar.getJarIdsByOwner(alice);
        assertEq(ids.length, 2);
        assertEq(ids[0], 0);
        assertEq(ids[1], 2);
        uint256[] memory bids = jar.getJarIdsByOwner(bob);
        assertEq(bids.length, 1);
        assertEq(bids[0], 1);
    }

    // ---------- isolation ----------
    function test_JarsAreIndependent() public {
        uint256 a = _create(alice);
        uint256 b = _create(bob);
        _deposit(alice, a, 10e6);
        _deposit(bob, b, 20e6);
        skip(1 days);
        vm.prank(alice);
        jar.withdrawAll(a);
        (,,, uint256 bb,) = jar.getJar(b);
        assertEq(bb, 20e6);
        assertEq(usdc.balanceOf(address(jar)), 20e6);
    }

    // ---------- fuzz ----------
    function testFuzz_DepositWithdrawAccounting(uint256 dep1, uint256 dep2, uint256 w1) public {
        dep1 = bound(dep1, 1, FUNDS / 2);
        dep2 = bound(dep2, 1, FUNDS / 2);
        uint256 id = _create(alice);
        _deposit(alice, id, dep1);
        _deposit(alice, id, dep2);
        (,,, uint256 bal,) = jar.getJar(id);
        assertEq(bal, dep1 + dep2);
        assertEq(usdc.balanceOf(address(jar)), dep1 + dep2);

        skip(1 days);
        w1 = bound(w1, 1, dep1 + dep2);
        vm.prank(alice);
        jar.withdraw(id, w1);

        (,,, bal,) = jar.getJar(id);
        assertEq(bal, dep1 + dep2 - w1);
        assertEq(usdc.balanceOf(address(jar)), bal);
        assertEq(usdc.balanceOf(alice), FUNDS - bal);
    }

    function testFuzz_OverWithdrawReverts(uint256 dep, uint256 extra) public {
        dep = bound(dep, 1, FUNDS);
        extra = bound(extra, 1, type(uint128).max);
        uint256 id = _create(alice);
        _deposit(alice, id, dep);
        skip(1 days);
        vm.prank(alice);
        vm.expectRevert(SavingsJar.InsufficientBalance.selector);
        jar.withdraw(id, dep + extra);
    }

    function testFuzz_TimeRemaining(uint64 offset, uint64 elapsed) public {
        offset = uint64(bound(offset, 1, 365 days));
        elapsed = uint64(bound(elapsed, 0, 730 days));
        vm.prank(alice);
        uint256 id = jar.createJar("f", uint64(block.timestamp) + offset);
        skip(elapsed);
        uint256 expected = elapsed >= offset ? 0 : offset - elapsed;
        assertEq(jar.timeRemaining(id), expected);
    }
}
