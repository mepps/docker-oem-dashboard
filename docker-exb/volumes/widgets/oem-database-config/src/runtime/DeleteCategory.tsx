import {Button, Modal, ModalHeader, ModalBody, ModalFooter, UrlInput, NumericInput} from 'jimu-ui'
import React, { Component } from 'react'

interface DeleteCategoryProps {
    deleteCategory: (id: number) => any
}

interface DeleteCateogryState {
    id: number
    open: boolean
}

/**
 * DeleteTemplate allows user to delete a Template from the database
 */
class DeleteCategory extends Component<DeleteCategoryProps, DeleteCateogryState> {

    constructor(props: any) {
        super(props);
        this.state = {
            id: null,
            open: false
        }
    }

    /**
     * Toggles the Modal open/closed
     */
    toggleOpen = () => {
        this.setState({
            open: !this.state.open
        });
    }

    /**
     * Closes the Modal and deletes the Template
     */
    close = () => {
        this.props.deleteCategory(this.state.id);
        this.toggleOpen();
    }
    render() {
        return (
            <div>
                <Button
                    onClick={this.toggleOpen}
                >
                    Delete Category
                </Button>
                <Modal
                    isOpen={this.state.open}
                    onClosed={function noRefCheck(){}}
                    onEnter={function noRefCheck(){}}
                    onExit={function noRefCheck(){}}
                    onOpened={function noRefCheck(){}}
                    toggle={this.toggleOpen}
                >
                    <ModalHeader toggle={this.toggleOpen}>
                        Delete Category
                    </ModalHeader>
                    <ModalBody>
                        <label>
                            Enter Object ID:{' '}
                            <NumericInput
                                onAcceptValue={(value) => this.setState({id: +value})}
                            />
                        </label>
                    </ModalBody>
                    <ModalFooter>
                        <Button
                            onClick={this.close}
                        >
                            Save
                        </Button>
                    </ModalFooter>
                </Modal>
            </div>
        )
    }
}

export default DeleteCategory;
